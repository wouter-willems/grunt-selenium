/*
 * grunt-selenium
 * https://github.com/sideroad/grunt-selenium
 *
 * Copyright (c) 2013 sideroad
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  var async = require('async'),
      spawn = require('simple-spawn').spawn,
      jsdom = require('jsdom'),
      path = require('path'),
      fs = require('fs'),
      jquery = fs.readFileSync( path.join( __dirname, '/lib/jquery-1.9.1.min.js' ), 'utf8').toString(),
      seleniumjar = __dirname+'/lib/selenium-server-standalone-2.31.0.jar',
      browser,
      isSuccess = true,
      storedVars = {},
      timeout,
      util = {
        elementBy: function(target){
          var location = this.location(target);
          grunt.log.debug('elementBy: ' + target );
          return browser.element( location.type, location.value );
        },
        waitForElement: function(target){
          var location = this.location(target);
          grunt.log.debug('waitForElement: ' + target );
          return browser.waitForElement( location.type, location.value, timeout );
        },
        location : function(target){
          var split = target.split('='),
              type = split.shift(),
              value = split.join('=').replace(/\&amp;/g,'&'),
              el;
          type = {
            'css': 'css selector',
            'link': 'link text'
          }[type] || type;
          return {type: type, value: value};
        },
        restore: function(str){
          return str.replace(/\$\{([^\}]+)\}/g, function(whole, name){
            return storedVars[name];
          });
        }
      },
      assert = {
        ok: function( cmd, actual, msg, tap){
          var is = 'ok';
          grunt.log.debug( cmd + ': "' + actual + '" is ok? ' + msg );
          if(!actual){
            grunt.log.error('['+cmd+'] was failed '+msg );
            isSuccess = false;
            is = 'not ok';
            tap.fail++;
          } else {
            tap.pass++;
          }
          tap.data.push( is + ' ' + tap.index + ' - ' + tap.name + ' - ' + cmd + ' ' + msg);
          tap.index++;
        },
        equal: function(cmd, actual, expected, msg, tap){
          var pattern,
              is = 'ok';
          expected = util.restore(expected);
          pattern = new RegExp("^"+(expected.replace(/(\.|\[|\]|\:|\?|\^|\{|\}|\(|\))/g,"\\$1").replace(/\*/g,".*"))+"$");

          grunt.log.debug( cmd + ': "' + actual + '" is equal "' + expected + '"? ' + msg );

          if(!pattern.test(actual)) {
            grunt.log.error('['+cmd+'] was failed '+msg+'\n'+
                            '  actual  :'+actual+'\n'+
                            '  expected:'+expected);
            isSuccess = false;
            is = 'not ok';
            tap.fail++;
          } else {
            tap.pass++;
          }
          tap.data.push( is + ' ' + tap.index + ' - ' + tap.name + ' - ' + cmd + ' ' + msg);
          tap.index++;
        }
      },
      cmd = {
        /*
         * Commands passed target, value arguments 
         */ 
        open: function(target){
          return this.then(function(){
            return browser.get(target);
          });
        },
        assertAlert: function( expected, msg, tap ){
          return this.then(function(){
            return browser.alertText();
          }).then(function(text){
            assert.equal('assertAlert', text, expected, msg, tap );
            return browser.acceptAlert();
          }).then(function(){});
        },
        assertElementPresent: function( target, msg, tap ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function(el){
            assert.ok('assertElementPresent', el, '['+target+']'+msg, tap );
          });
        },
        assertElementNotPresent: function( target, msg, tap ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function(el){
            assert.ok('assertElementPresent', !el, '['+target+']'+msg, tap );
          });
        },
        assertLocation: function( expected, msg, tap ){
          return this.then(function(){
            return browser.execute('window.location.href');
          }).then(function( href ){
            assert.equal('assertLocation', href, expected, msg, tap );
          });
        },
        assertText: function( target, expected, tap ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function(el){
            return el.text();
          }).then(function(text){
            assert.equal('assertText', text, expected, '['+target+']', tap );
          });
        },
        assertTextPresent: function( expected, msg, tap ){
          return this.then(function(){
            return browser.textPresent( expected, 'body' );
          }).then(function( isPresented ){
            assert.ok('assertTextPresent', isPresented, '['+expected+']'+msg, tap );
          });
        },
        assertTextNotPresent: function( expected, msg, tap ){
          return this.then(function(){
            return browser.textPresent( expected, 'body' );
          }).then(function( isPresented ){
            assert.ok('assertTextPresent', !isPresented, '['+expected+']'+msg, tap );
          });
        },
        assertTitle: function( expected, msg, tap){
          return this.then(function(){
            return browser.title();
          }).then(function(title){
            assert.equal( 'assertTitle', title, expected, msg, tap );
          });
        },
        click: function( target ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function( el ){
            return browser.clickElement(el);
          }).then(function(){});
        },
        clickAndWait: function( target ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function( el ){
            return browser.clickElement(el);
          }).then(function(){});
        },
        deleteCookie: function( name ){
          return this.then(function(){
            return browser.deleteCookie(name);
          }).then(function(){});
        },
        echo: function( value ){
          grunt.log.writeln(util.restore(value));
          return this;
        },
        goBack: function(){
          return this.then(function(){
            return browser.back();
          }).then(function(){});
        },
        goBackAndWait: function(){
          return this.then(function(){
            return browser.back();
          }).then(function(){});
        },
        store: function( value , name ){
          storedVars[name] = value;
          return this;
        },
        storeElementPresent: function( target, name ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function(el){
            storedVars[name] = el ? true : false;
          });
        },
        storeEval: function( script, name ){
          return this.then(function(){
            return browser.execute( script );
          }).then(function( result ){
            storedVars[name] = result;
          });
        },
        storeText: function( target, name ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function(el){
            return el.text();
          }).then(function(text){
            storedVars[name] = text;
          });
        },
        type: function( target, keys ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function( el ){
            return browser.type(el, keys);
          }).then(function(){});
        },
        verifyElementPresent: function( target, msg, tap ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function(el){
            assert.ok('verifyElementPresent', el, '['+target+']'+msg, tap );
          });
        },
        verifyElementNotPresent: function( target, msg, tap ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function(el){
            assert.ok('verifyElementPresent', !el, '['+target+']'+msg, tap );
          });
        },
        verifyText: function( target, expected, tap ){
          return this.then(function(){
            return util.elementBy(target);
          }).then(function(el){
            return el.text();
          }).then(function(text){
            assert.equal('verifyText', text, expected, '['+target+']', tap );
          });
        },
        verifyTextPresent: function( expected, msg, tap ){
          return this.then(function(){
            return browser.textPresent( expected, 'body' );
          }).then(function( isPresented ){
            assert.ok('verifyTextPresent', isPresented, '['+expected+']'+msg, tap );
          });
        },
        verifyTextNotPresent: function( expected, msg, tap ){
          return this.then(function(){
            return browser.textPresent( expected, 'body' );
          }).then(function( isPresented ){
            assert.ok('verifyTextPresent', !isPresented, '['+expected+']'+msg, tap );
          });
        },
        verifyTitle: function( expected, msg, tap){
          return this.then(function(){
            return browser.title();
          }).then(function(title){
            assert.equal( 'verifyTitle', title, expected, msg, tap );
          });
        },
        waitForElementPresent: function(target){
          return this.then(function(){
            return util.waitForElement(target);
          }).then(function(){});
        }
      },
      key,
      supportedCmds = [];

  for(key in cmd){
    supportedCmds.push(key);
  }
  
  grunt.registerMultiTask('selenium', 'Run selenium', function( data ) {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
          browsers: ['firefox'],
          timeout: 10000
        }),
        done = this.async(),
        child,
        that = this;

    grunt.log.debug(supportedCmds.join('\n'));
    grunt.log.debug('Setup Selenium Server...');
    child = spawn('java -jar ' + seleniumjar);

    child.stderr.on('data', function(data){
      grunt.log.debug(''+data);
    });

    child.stdout.on('data', function(data){
      data = (''+data).replace(/\n$/,'');
      grunt.log.debug(data);
      if( !data.match('Started org.openqa.jetty.jetty.Server') ) {
        return;
      }
      var wd = require('wd'),
          promise;

      that.files.forEach(function(f) {
        var suites = f.src.filter(function(filepath) {
              if (!grunt.file.exists(filepath)) {
                grunt.log.warn('Source file "' + filepath + '" not found.');
                return false;
              } else {
                return true;
              }
            }),
            tap = {
              data:['TAP version 13'],
              name: "",
              index:1,
              pass: 0,
              fail: 0
            };

        async.mapSeries( options.browsers, function(browserName, callback){
          tap.name = browserName;
          grunt.log.writeln('Setup browser ['+browserName+']');
          browser = wd.promiseRemote();
          promise = browser.init({
            browserName: browserName,
            name: 'This is an example test'
          });
          timeout = options.timeout;

          async.mapSeries( suites, function( suite, callback ){
            grunt.log.writeln('  Running suite['+suite+']');

            jsdom.env({
              html: suite,
              src: [jquery],
              done: function(errors, window){
                var $ = window.$,
                    hrefs = [];

                $('a[href]').each(function(){
                  hrefs.push(this.href);
                });
                async.map( hrefs, function( href, callback ){
                  jsdom.env({
                    html: fs.readFileSync( href, 'utf8').toString(),
                    src: [jquery],
                    done: function(errors, window){
                      var $ = window.$,
                          testcase = $('thead tr td').html();
                      promise = promise.then(function(){
                        grunt.log.writeln( '    Running test case['+testcase+']' );
                      });
                      $('tbody').find('tr').each(function(){
                        var $tr = $(this),
                            command = $tr.find('td:eq(0)').html(),
                            target = $tr.find('td:eq(1)').html(),
                            value = $tr.find('td:eq(2)').html();
                        promise = ( 
                          cmd[command]||
                          function( target, value ){
                            grunt.log.warn('Command not supported['+command+']');
                            return this;
                          }
                        ).apply( promise, [ target, value, tap ] );
                      });
                      promise = promise.then(function(){
                        grunt.log.writeln('    Finish  test case['+testcase+']');
                        callback(promise);
                      });
                    }
                  });
                }, function( err, results ){
                  promise = promise.then(function(){
                    storedVars = {};
                    grunt.log.writeln('  Finish suite['+suite+']');
                    callback();
                  });
                });
              }
            });
          }, function(){
            promise = promise.then(function(){
              grunt.log.writeln('Teardown browser ['+browserName+']');
              return browser.quit();
            }).fin(function(){
              callback();
            }).done();
          });
        }, function(){
          tap.data.push('');
          tap.data.push('1..'+(tap.pass + tap.fail));
          tap.data.push('# tests '+(tap.pass + tap.fail));
          tap.data.push('# pass '+ tap.pass);
          tap.data.push('# fail '+ tap.fail);
          grunt.file.write(f.dest, tap.data.join('\n'));      
          child.kill();
          done(options.force || isSuccess);
        });
      });
    });
  });
};
