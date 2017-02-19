console.log('app running')
var http = require('http'),
    fs = require('fs'),
    jsdom = require("jsdom"),
    winston = require("winston"),
    moment = require("moment"),
    jquery = fs.readFileSync("./node_modules/jquery/dist/jquery.min.js", "utf-8"),
    $ = require("jquery"),
    Q = require("q"),
    Twit = require('twit'),
    config = require('./config/config'),
    clubInfos = require('./config/clubInfos'),
    _ = require('underscore');

(function() {

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
                fs.writeFile('./tmp/last_.txt', JSON.stringify(iP), (err) => {
                    if (err)
                        throw err;
                    console.log('It\'s saved!');
                });
                resolve(iP)
            }
        });
    });

    getCurrentInjuredPlayers.then(function(iP) {


          var requestYesterday = new Promise(function(resolve, reject) {

              fs.readFile("./tmp/last.txt", "utf-8", function(error, yesterday) {
                  if (error) {
                      deferred.reject(new Error(error));
                  } else {

                      var today = _.map(iP, function(x) {
                          return JSON.stringify(x);
                      });

                      yesterday = JSON.parse(yesterday);

                      var yesterday = _.map(yesterday, function(x) {
                          return JSON.stringify(x);
                      });

                      var fiP = _.map(_.difference(today, yesterday), function(x) {
                          return JSON.parse(x);
                      });

                      resolve(fiP)
                  }
              });
          });

          requestYesterday.then(function(fiP){
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
                return 'ist verletzt'
            } else {
                return 'ist bis zum ' + moment(date).format('DD.MM.') + ' verletzt';
            }
        }
        var createHashtag = function() {
            // push good hashtags
        }
        items.forEach(item => bT.push(item.name + ' (' + item.verein + ') ' + enchantDate(item.bis) + enchantClub(item.verein)))
        return postTweet(bT);
    };

    // post tweet to bot
    var postTweet = function(items) {
        var T = new Twit(config);
        console.log(items.length)
        items.forEach(item => T.post('statuses/update', {
            status: item
        }, function(err, data, response) {
            console.warn(item)
        }))
    };

}());
