var fs = require('fs');
var querystring = require('querystring');
var jsdom = require('jsdom');
var jquery = fs.readFileSync('./jquery.min.js', 'utf-8').toString();

function pickArray(obj) {
    var arr = [];

    for (var i = 0; i < obj.length; i++) {
        arr.push(obj[i]);
    }

    return arr;
}

function getActor($) {
    // actor name
    var selector = '.cast ul li p';
    var actorList = $(selector).map(function() {
        return this.childNodes[0].nodeValue;
    });
    var actorName = pickArray(actorList);

    // actor photo
    var selector = '.cast ul li img';
    var actorPhotoList = $(selector).map(function() {
        return this.attributes.src.value;
    });
    var actorPhoto = pickArray(actorPhotoList);

    // zip all both of them
    var getActor = [];
    for (var i = 0; i < actorName.length; i++) {
        getActor.push({
            name: actorName[i],
            photo: actorPhoto[i]
        });
    }

    return getActor;
}

function saveToDB(film) {
    if (film.title()) {
        var query = 'INSERT INTO Film(url, title, poster, synopsis, rating, duration) VALUES(' +
                        "'" + film.url + "', " +
                        '"' + querystring.escape(film.title()).trim() + '", ' +
                        "'" + film.src() + "', " +
                        '"' + querystring.escape(film.synopsis()) + '", ' +
                        "'" + film.rating() + "', " +
                        film.duration() + "); ";

        var actorsQuery = [];

        for (var i = 0; i < film.actor().length; i++) {
            var actorQuery = 'INSERT INTO Actor(film_title, film_poster, name, photo_url) VALUES(' +
                            '"' + querystring.escape(film.title()).trim() + '", ' +
                            "'" + film.src() + "', " +
                            '"' + querystring.escape(film.actor()[i].name).trim() + '", ' +
                            "'" + film.actor()[i].photo + "'); ";

            actorsQuery.push(actorQuery);
        }

        return query + '\n' + actorsQuery.join('\n');
    } else {
        return '';
    }
}

function saveComingSoonDb(film) {
    if (film.titleForComingSoon()) {
        return 'INSERT INTO ComingSoonFilm(title, poster) VALUES(' +
                        '"' + querystring.escape(film.titleForComingSoon()).trim() + '", ' +
                        "'" + film.srcForComingSoon() + "');";
    } else {
        return '';
    }
}

function setHtmlDocument(url, callback) {
    jsdom.env({
        html: fs.readFileSync(url, 'utf-8').toString(),
        src: [jquery],
        done: function(err, window) {
            var $ = window.$;

            var query = {
                url: url,
                title: function() {
                    var selector = '.detmov-side img';
                    return ( $(selector).length ) ? $(selector)[0].attributes.title.value : false;
                },
                src: function() {
                    var selector = '.detmov-side > img';
                    return $(selector)[0].attributes.src.value;
                },
                synopsis: function() {
                    var selector =  'head meta[name=description]';
                    return ( $(selector).length ) ? $(selector)[0].attributes.content.value : '';
                },
                actor: function() {
                    return getActor($);
                },
                rating: function() {
                    var selector = '.movinfo [title]';
                    return ( $(selector).length ) ? $(selector)[0].attributes.title.value : '';
                },
                duration: function() {
                    var selector = '.duration h3';
                    return ( $(selector).length ) ? $(selector)[0].childNodes[0].nodeValue : 0;
                },
                titleForComingSoon: function() {
                    var selector = '.col-m_462 .col-content ul li a img';
                    return ( $(selector).length ) ? $(selector)[0].attributes.title.value : false;
                },
                srcForComingSoon: function() {
                    var selector = '.col-m_462 .col-content ul li a img';
                    return $(selector)[0].attributes.src.value;
                }
            };

            if ( query.title() ) {
                callback(query);
                window.close();
                return true;
            } else if ( query.titleForComingSoon() ) {
                callback(query);
                window.close();
                return true;
            } else {
                window.close();
                return false;
            }
        }
    });
}

fs.readdir('21cineplex', function( err, files ) {
    files
        .filter(function( file ) {
            return file.substr(-4) == '.htm'
        })
        .forEach(function( file ) {
            setHtmlDocument('21cineplex/' + file, function(film){
                console.log( saveToDB(film) );
            });
        });
});

fs.readdir('21cineplex/comingsoon', function( err, files ) {
    files.forEach(function( file ) {
        setHtmlDocument('21cineplex/comingsoon/' + file, function(film){
            console.log( saveComingSoonDb(film) );
        });
    });
});
