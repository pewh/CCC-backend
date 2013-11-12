var express = require('express');
var app = express();
var server = require('http').createServer(app);
var hostname = require('os').hostname();
var mysql = require('mysql');
var _ = require('underscore');

function findIndexWhere(arr, item) {
    for (var i = 0; i < arr.length; i++) {
        if ( arr[i] === item ) {
            return i;
        }
    }
    return -1;
}

app.set('port', process.env.PORT || 8888);
app.use(express.bodyParser());
app.use(express.static(__dirname + '/21cineplex'));
app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
}));

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'ccc'
});

connection.connect(function(err) {
    if (err) {
        console.log(err);
        process.exit(1);
    }
});

function inference(query) {
    return query;
}

app.get('/', function(req, res) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With');

    // TRANSFORM req.query.q to check what does it mean
    switch ( inference(req.query.q) ) {
        case 'coming':
            connection.query('SELECT * FROM ComingSoonFilm', function( err, rows, fields) {
                var movieString = rows.map(function(row) {
                    
                    var hostname = 'http://' + server.address().address + ':' + server.address().port;

                    return [
                        '<tr>',
                            '<td>',
                                '<img src="' + hostname + row.poster + '"></img>',
                            '</td>',
                            '<td valign=top><strong>',
                                unescape(row.title),
                            '</strong></td>',
                        '</tr>',
                    ].join('');
                });

                var output = [
                    'Daftar film yang akan datang: <br />',
                    '<table class="coming-soon">',
                        movieString.join(''),
                    '</table>'
                ].join('');

                res.send(output);
            });
            break;
        case 'now':
            connection.query('SELECT * FROM NowPlayingFilm', function( err, rows, fields) {
                var movie = [];
                var movieNameList = _.pluck(rows, 'title');

                for (var i = 0; i < rows.length; i++) {
                    var storedMovie = _.pluck(movie, 'title')
                    var movieTitle = rows[i].title;

                    if ( movie.length && _.contains( storedMovie, movieTitle ) ) {

                        var index = findIndexWhere( storedMovie, movieTitle);
                        var selectedMovie = movie[index];
                        selectedMovie.time.push(rows[i].time);

                    } else {
                        var y = rows[i];

                        movie.push({
                            title: y.title,
                            poster: y.poster,
                            time: [y.time]
                        });

                    }
                }

                var movieDetailList = [];
                var hostname = 'http://' + server.address().address + ':' + server.address().port;

                for (var i = 0; i < movie.length; i++) {
                    var timeRows = movie[i].time.join(' ');

                    movieDetailList.push([
                        '<tr>',
                            '<td rowspan=2>',
                                '<img src="' + hostname + movie[i].poster + '"></img>',
                            '</td>',
                            '<td><strong>',
                                unescape(movie[i].title),
                            '</strong></td>',
                        '</tr>',
                        '<tr>',
                            '<td>',
                            timeRows,
                            '</td>',
                        '</tr>'
                    ].join(''));
                }

                var output = [
                    'Daftar film yang sedang tayang:',
                    '<table class="coming-soon">',
                        movieDetailList.join(''),
                    '</table>'
                ].join('');

                res.send(output);
            });
            break;
        default:
            res.send(req.query.q);
    }
});

server.listen(app.get('port'), function() {
    console.log('Running on http://0.0.0.0:' + app.get('port'));
})
