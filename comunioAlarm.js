var dev = true;

var http = require('http'),
    fs = require('fs'),
    jsdom = require("jsdom"),
    //winston = require("winston"),
    moment = require("moment"),
    jquery = fs.readFileSync("./node_modules/jquery/dist/jquery.min.js", "utf-8"),
    $ = require("jquery"),
    //Q = require("q"),
    cron = require('node-cron'),
    Twit = require('twit'),
    clubInfos = require('./config/clubInfos'),
    _ = require('underscore');

if (dev) {
    console.log('app running in dev mode');
    var config = require('./config/config.default.js');
} else {
    console.log('app running in live mode');
    var config = require('./config/config');
}

(function() {

    var comunioAlarm = function() {
        console.log('i do it')

        "use strict";

        var getCurrentInjuredPlayers = new Promise(function(resolve, reject) {

            jsdom.env({
                url: 'http://' + config.host + config.path,
                scripts: ["http://code.jquery.com/jquery.js"],
                created: function(errors, window) {
                    console.log('created')
                },
                done: function(errors, window) {
                    var $ = window.$;
                    var iP = [];
                    $("#yw2 table.items tbody tr.odd,#yw2 table.items tbody tr.even").each(function() {
                        iP.push({name: $(this).find('td.hauptlink a.spielprofil_tooltip').text(), grund: $(this).find('td:nth-child(5)').text(), bis: $(this).find('td:nth-child(7)').text(), verein: $(this).find('td:nth-child(2) img').attr('alt')});
                    });
                    console.log('all injured players loaded')
                    // todo rewrite or delete today.txt in yesterday.txt
                    fs.rename('./tmp/last.txt', './tmp/past.txt', function(err) {
                        if (err)
                            throw err;
                        console.log('rename complete');
                        fs.writeFile('./tmp/last.txt', JSON.stringify(iP), (err) => {
                            if (err)
                                throw err;
                            console.log('It\'s saved!');
                        });
                    });
                    resolve(iP)
                }
            });
        });

        getCurrentInjuredPlayers.then(function(iP) {

            var requestYesterday = new Promise(function(resolve, reject) {

                fs.readFile("./tmp/past.txt", "utf-8", function(error, yesterday) {
                    if (error) {
                        reject(new Error(error));
                    } else {

                        var today = _.map(iP, function(x) {
                            return JSON.stringify(x);
                        });

                        yesterday = JSON.parse(yesterday);

                        var yesterday = _.map(yesterday, function(x) {
                            return JSON.stringify(x);
                        });
                        (dev)
                            ? yesterday = []
                            : dev;
                        var fiP = _.map(_.difference(today, yesterday), function(x) {
                            return JSON.parse(x);
                        });

                        resolve(fiP)
                    }
                });
            });

            requestYesterday.then(function(fiP) {
                buildTweet(fiP);
            })

        }, function(error) {
            console.log('Promise rejected.');
        });

        // gen message, player name, länge , maybe twitter acc an @comunio
        var buildTweet = function(items) {
            console.log('builde tweets');
            var bT = [];
            var checkTweet = function(tweet) {
                console.log(tweet.length, config.maxTweetLength)
                //(tweet.length > config.maxTweetLength) ? console.log('tweet zu lang') : bT.push(tweet.name + ' vom ' + tweet.verein + ' hat sich verletzt')
            }
            var enchantClub = function(club) {
                // converts Club to twitter account
                // create a list and push to mongo
                if (typeof(clubInfos[club]) !== 'undefined') {
                    return ' ' + clubInfos[club].twitter;
                } else {
                    return '';
                }
            }
            var enchantPlayer = function() {
                // converts Player to twitter account
                // create a list and push to mongo
            }
            var enchantDate = function(date) {
                date = moment(date, "DD-MM-YYYY");
                if (!date.isValid()) {
                    return 'fällt aus'
                } else {
                    return 'fällt bis zum ' + moment(date).format('DD.MM.') + ' aus';
                }
            }
            var createHashtag = function() {
                // push good hashtags
            }
            items.forEach(item => bT.push(item.name + ' (' + item.verein + ') ' + enchantDate(item.bis) + enchantClub(item.verein) + ' #comunio #comunioAlarm'))
            return postTweet(bT);
        };

        // post tweet to bot
        var postTweet = function(items) {
            var T = new Twit(config);
            console.log(items.length)

            if (items.length > 0) {
                items.forEach(item => T.post('statuses/update', {
                    status: '🤕 ' + item
                }, function(err, data, response) {
                    console.warn('(' + item.length + ')tweete: ', item)
                }))
            } else {
                T.post('statuses/update', {
                    status: '⚽️ Keine neuen Verletzten (puh!) '
                }, function(err, data, response) {
                    console.warn('Keine neuen Verletzten (puh!) ')
                })
            }
        };
    }

    comunioAlarm();
    var minute = 10;
    cron.schedule('*/' + minute + ' * * * *', function() {
        console.log('running a task every ' + minute + ' minutes');
        comunioAlarm();
        minute = Math.floor((Math.random() * 10) + 1);

    });

})();
