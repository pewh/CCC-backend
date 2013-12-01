var express = require('express');
var app = express();
var server = require('http').createServer(app);
var mysql = require('mysql');
var _ = require('underscore');
var nlp = require('./nlp');

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

app.get('/', function(req, res) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With');
    var hostname = 'http://' + req.headers.host;

    if ( ! req.query.q ) {
        res.send('Silahkan masukkan pertanyaan');
        return;
    }

    if ( nlp.processor(req.query.q) === 'coming' ) {
        connection.query('SELECT * FROM ComingSoonFilm', function( err, rows, fields) {
            var movieString = rows.map(function(row) {
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
                nlp.getPrefixQuestion(req.query.q) + ' adalah: <br />',
                '<table class="coming-soon">',
                    movieString.join(''),
                '</table>'
            ].join('');

            res.send(output);
        });
    } else if ( nlp.processor(req.query.q) === 'now' ) {
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
                nlp.getPrefixQuestion(req.query.q) + ' adalah: <br />',
                '<table class="coming-soon">',
                    movieDetailList.join(''),
                '</table>'
            ].join('');

            res.send(output);
        });
    } else if ( _.isObject(nlp.processor(req.query.q))) {

        var keyword = nlp.processor(req.query.q);

        if ( keyword.isList ) {
            var query = 'SELECT poster, ' + keyword.find + ' FROM Film INNER JOIN Actor ON Film.title = Actor.film_title AND Film.poster = Actor.film_poster WHERE ' +
                        keyword.get + ' = "' + escape(keyword.entity) + '"';

            connection.query(query, function( err, rows, fields) {
                if ( rows.length ) {
                    var outputList = [];

                    for (var i = 0; i < rows.length; i++) {

                        outputList.push([
                            '<tr>',
                                '<td>',
                                    '<img src="' + hostname + rows[i].poster + '"></img>',
                                '</td>',
                                '<td><strong>',
                                    unescape(rows[i][keyword.find]),
                                '</strong></td>',
                            '</tr>'
                        ].join(''));
                    }

                    var output = [
                        nlp.getPrefixQuestion(req.query.q) + ' adalah: <br />',
                        '<table>',
                            outputList.join(''),
                        '</table>'
                    ].join('');

                    res.send(output);
                } else {
                    res.send(keyword.type + ' ' + keyword.entity + ' tidak ditemukan');
                }
            });
        } else {
            var query = 'SELECT DISTINCT ' + keyword.find + ' FROM Film INNER JOIN Actor ON Film.title = Actor.film_title AND Film.poster = Actor.film_poster WHERE ' +
                        keyword.get + ' = "' + escape(keyword.entity) + '"';

            connection.query(query, function( err, rows, fields) {
                if ( rows.length ) {

                    var value = rows[0][keyword.find];

                    if ( value ) {
                        var answer = nlp.getPrefixQuestion(req.query.q) + ' adalah ';

                        if ( keyword.find === 'synopsis' ) {
                            answer += '<b>' + ('' + value).toLowerCase() + '</b>';
                        } else {
                            answer += ('' + value).toLowerCase();
                        }

                        if ( keyword.find === 'duration' ) {
                            answer += ' menit';
                        }

                        res.send(unescape(answer));
                    } else {
                        res.send('Tidak diketahui');
                    }

                } else {
                    res.send(keyword.type + ' ' + keyword.entity + ' tidak ditemukan');
                }
            });
        }
    } else {
        res.send('Maaf. Pertanyaan tidak dikenali.');
    }
});

server.listen(app.get('port'), function() {
    console.log('Running on http://0.0.0.0:' + app.get('port'));
})
