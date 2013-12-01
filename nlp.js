var _ = require('underscore');
_.str = require('underscore.string');
_.mixin(_.str.exports());

var q = require('./questions');
var pos = require('./pos');

function findNERIndexOnMetadata(metadata) {
    var arr = _.pluck(metadata, 'ner');

    if ( _.any(arr) ) {
        for (var i = 0; i < arr.length; i++) {
            if ( arr[i] ) {
                return i;
            }
        }
    }
    return -1;
}

function tokenization( str ) {
    if ( _(str).endsWith('?') ) {
        str = str.substr(0, str.length - 1);
    }

    tokens = str.split(' ');

    return _.chain(tokens)
            .invoke('toLowerCase')
            .without('')
            .value();
};


/** PRIVATE
function _collectTokens( arr, isNestedArr ) {
    if ( isNestedArr ) {
        arr =  _.chain(arr)
                .values()
                .flatten()
                .value();
    }

    var tokenList = _.map(arr, function(str) {
        return tokenization(str);
    });

    return _.chain(tokenList)
            .flatten()
            .uniq()
            .value();
}
*/


String.prototype.extractPOS = function() {
    return function( str ) {
        var tokens = tokenization( str );

        return _.map(tokens, function( token ) {
            return pos[token];
        });
    }(this);
}


function containUnknownPOS(metadata) {
    return _.contains( _.pluck(metadata, 'pos'), undefined );
}

function PRE_FILM(token) {
    return _.contains(['film'], token);
}

function PRE_ACTOR(token) {
    return _.contains(['aktor', 'artis'], token);
}

function NUMBER(token) {
    return _.isNumber(token);
}

function containsMultiArray(arr, item) {
    for (var i = 0; i < arr.length; i++) {
        if ( JSON.stringify(arr[i]) === JSON.stringify(item) ) {
            return true;
        }
    }

    return false;
}

var rulesOfFilmEntity = [
    [1, 2],
    [1, 4],
    [1, 8],
    [7, 8]
];

var rulesOfActorEntity = [
    [1, 3],
    [1, 5],
    [1, 6],
    [1, 9]
];

function getMatchedRules( metadata ) {
    var rules = [];

    for (var i = 0; i < metadata.length; i++) {

        rules.push(i);
        rules[i] = [];

        var prevMetadata = metadata[i - 1];

        if ( !metadata[i].pos ) {
            rules[i].push(1);

            if ( i ) {
            
                if ( PRE_FILM( prevMetadata.word ) ) {
                    rules[i].push(2);
                }

                if ( PRE_ACTOR( prevMetadata.word ) ) {
                    rules[i].push(3);
                }

                if ( (prevMetadata.pos === 'VBa' || prevMetadata.pos === 'VBp') ) {
                    rules[i].push(4);
                }

                if ( prevMetadata.pos === 'IN' ) {
                    rules[i].push(5);
                }

                if ( prevMetadata.pos === 'PR' ) {
                    rules[i].push(6);
                }

                if ( prevMetadata.entity ) {
                    if ( prevMetadata.entity === 'film' ) {
                        rules[i].push(8);
                    } else if ( prevMetadata.entity === 'actor' ) {
                        rules[i].push(9);
                    }
                }
            }

            if ( NUMBER( metadata[i].word ) ) {
                rules[i].push(7);
            }

        }
    }

    var ner = [];

    for (var i = 0; i < metadata.length; i++)
    {
        if ( containsMultiArray(rulesOfFilmEntity, rules[i]) )
        {
            ner.push('film');
        }
        else if ( containsMultiArray(rulesOfActorEntity, rules[i]) )
        {
            ner.push('actor');
        }
        else if ( i && rules[i][0] === 1 )
        {
            var prevNer = ner[i - 1];
            ner.push(prevNer);
        }
        else
        {
            ner.push(null);
        }
    }

    return ner;
}

function predictNER(metadata) {
    var ner = getMatchedRules(metadata);
    var processedMetadata = metadata;

    for (var i = 0; i < ner.length; i++) {
        if ( ner[i] ) {
            processedMetadata[i].ner = ner[i];
        }
    }

    return embedNER(processedMetadata);
}

String.prototype.extractMetadata = function() {
    return function( str ) {
        var tokens = tokenization( str );

        var metadata = _.map(tokens, function( token ) {
            return {
                word: token,
                pos: pos[token]
            };
        });
        //return containUnknownPOS(metadata) ? predictNER(metadata) : metadata;
        if ( containUnknownPOS(metadata) ) {
            return predictNER(metadata);
        } else {
            return metadata;
        }

    }(this);
}


function questionsToPOS( questions ) {
    return _.chain( questions )
            .values()
            .flatten()
            .invoke('extractPOS')
            .uniq(JSON.stringify)
            .value();
}


function embedNullOnPOS( pos ) {
    var posSequence = pos;

    for ( var i = posSequence.length - 1; i > 0; i-- ) {
        if ( !posSequence[i] && !posSequence[i - 1] ) {
            posSequence.splice(i, 1);
        }
    }

    return posSequence;
}

function embedNER( metadata ) {
    for ( var i = metadata.length - 1; i > 0; i-- ) {
        if ( metadata[i].ner &&
             metadata[i - 1].ner &&
             metadata[i].ner === metadata[i - 1].ner )
        {
            metadata[i - 1].word += ' ' + metadata[i].word;
            metadata.splice(i, 1);
        }
    }

    return metadata;
}

function validate( question ) {
    var whitelistPOS = questionsToPOS(q).map(function(posSequence) {
        return JSON.stringify(posSequence);
    });

    var posOnQuestion = JSON.stringify( embedNullOnPOS( question.extractPOS()) );

    return _.contains( whitelistPOS, posOnQuestion );
}

function inference( metadata ) {
    var token = _.pluck(metadata, 'word');

    if ( ! _.any( _.pluck(metadata, 'ner') ) ) {
        // not NER
        if ( _.contains(token, 'sedang') || _.contains(token, 'lagi') ) {
            return 'now';
        } else if ( _.contains(token, 'akan') ) {
            return 'coming';
        }
    } else {
        var nerIndex = findNERIndexOnMetadata(metadata);
        var entity = metadata[nerIndex].word;

        // TODO still buggy on film n actor
        if ( _.contains(token, 'siapa') || _.contains(token, 'aktor') || _.contains(token, 'pemain') ) {
            return {
                find: 'name',
                get: 'title',
                type: 'Film',
                entity: entity,
                isList: true
            };
        } else if ( _.contains(token, 'kategori') || _.contains(token, 'genre') ||_.contains(token, 'jenis')  || _.contains(token, 'layak')  || _.contains(token, 'cocok')  || _.contains(token, 'boleh')  || _.contains(token, 'bisa') ) {
            return {
                find: 'rating',
                get: 'title',
                type: 'Film',
                entity: entity,
                isList: false
            };
        } else if ( _.contains(token, 'durasi') || _.contains(token, 'lama') ) {
            return {
                find: 'duration',
                get: 'title',
                type: 'Film',
                entity: entity,
                isList: false
            };
        } else if ( _.contains(token, 'sinopsis') ) {
            return {
                find: 'synopsis',
                get: 'title',
                type: 'Film',
                entity: entity,
                isList: false
            };
        } else if ( _.contains(token, 'film') ) {
            return {
                find: 'title',
                get: 'name',
                type: 'Aktor',
                entity: entity,
                isList: true
            };
        }
    }
}

function processor( question ) {
    if ( validate(question) ) {
        return inference(question.extractMetadata());
    } else {
        return false;
    }
}

function getPrefixQuestion( q ) {
    var questions = q.extractMetadata();
    var questionWithoutWH = _.reject(questions, function(question) {
        return question.pos === 'WH' || question.word === 'saja';
    });
    var joinedPrefixQuestion = _.pluck(questionWithoutWH, 'word').join(' ');
    var capitalizeFirstChar = _(joinedPrefixQuestion).capitalize();

    return capitalizeFirstChar;
}

module.exports.processor = processor;
module.exports.getPrefixQuestion = getPrefixQuestion;
