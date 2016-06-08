var unirest = require('unirest');
var express = require('express');
var events = require('events');
var async = require('async');

var getFromApi = function(endpoint, args) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/' + endpoint)
        .qs(args)
        .end(function(response) {
            if (response.ok) {
                emitter.emit('end', response.body);
            } else {
                emitter.emit('error', response.code);
            }
        });
    return emitter;
};

var getRelated = function(id) {
    var emitter = new events.EventEmitter();
    unirest.get('https://api.spotify.com/v1/artists/' + id + '/related-artists')
        .end(function(response) {
            if (response.ok) {
                emitter.emit('end', response.body);
            } else {
                emitter.emit('error', response.code);
            }
        });
    return emitter;
};

var getTracks = function(artist) {
    var emitter = new events.EventEmitter();
    var topTracks = [];

    for (var i = 0; i < artist.related.length; i++) {
        var id = artist.related[i].id;
        topTracks.push({
            id: id,
            url: 'https://api.spotify.com/v1/artists/' + id + '/top-tracks?country=GB',
            tracks: []
        });
    }

    addTracks = function(item, callback) {
        unirest.get(item.url)
            .end(function(response) {
                if (response.ok) {
                    item.tracks = response.body.tracks;
                    callback(null, item);
                } else {
                    callback(response.code);
                }
            });
    };

    async.map(topTracks, addTracks, function(err, res) {
        if (!err) {
            res.map(function(item, i) {
                artist.related[i].tracks = res[i].tracks;
            });
            emitter.emit('end', artist);
        } else {
            emitter.emit('error', res.code);
        }

    });

    return emitter;
};


var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
    var searchReq = getFromApi('search', {
        q: req.params.name,
        limit: 1,
        type: 'artist'
    });

    searchReq.on('end', function(item) {
        var artist = item.artists.items[0];
        var artistId = artist.id;

        getRelated(artistId).on('end', function(data) {
            artist.related = data.artists;
            getTracks(artist).on('end', function(updated) {
                res.json(updated);
            });
        });
    });

    searchReq.on('error', function(code) {
        res.sendStatus(code);
    });
});

app.listen(8080);
