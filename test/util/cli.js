/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2014 Apigee Corporation

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
'use strict';

var should = require('should');
var config = require('../../config');
var proxyquire =  require('proxyquire');
var _ = require('lodash');

describe('cli', function() {

  var cliStubs = {
    'inquirer': {
      prompt: function(questions, cb) {
        var results = {};
        if (!_.isArray(questions)) { questions = [questions]; }
        _.each(questions, function(question) {
          results[question.name] =
            (question.hasOwnProperty('default') && question.default !== undefined)
              ? question.default
              : (question.type === 'list') ? question.choices[0] : 'XXX';
        });
        cb(results);
      }
    }
  };
  var cli = proxyquire('../../lib/util/cli', cliStubs);

  beforeEach(function() {
    config.browser = undefined;
  });

  var FIELDS = [
    { name: 'baseuri',      message: 'Base URI?', default: 'https://api.enterprise.apigee.com' },
    { name: 'organization', message: 'Organization?' },
    { name: 'password',     message: 'Password?', type: 'password' }
  ];

  describe('requireAnswers', function() {

    it('should ensure all questions are answered', function(done) {

      cli.requireAnswers(FIELDS, {}, function(results) {
        results.baseuri.should.equal('https://api.enterprise.apigee.com');
        results.organization.should.equal('XXX');
        results.password.should.equal('XXX');
        done();
      });
    });

    it('should not ask for questions already answered', function(done) {

      var results = {
        password: 'password'
      };

      cli.requireAnswers(FIELDS, results, function(results) {
        results.password.should.equal('password');
        done();
      });
    });

  });

  describe('updateAnswers', function() {

    it('should ask all questions', function(done) {

      cli.updateAnswers(FIELDS, {}, function(results) {
        results.organization.should.equal('XXX');
        results.baseuri.should.equal('XXX');
        results.password.should.equal('XXX');
        done();
      });
    });


    it('should default to existing answers', function(done) {

      var results = {
        baseuri: 'baseuri'
      };

      cli.updateAnswers(FIELDS, results, function(results) {
        results.organization.should.equal('XXX');
        results.baseuri.should.equal('baseuri');
        done();
      });
    });

    it('should not default password', function(done) {

      var results = {
        password: 'password'
      };

      cli.updateAnswers(FIELDS, results, function(results) {
        results.password.should.equal('XXX');
        done();
      });
    });

  });

  describe('confirm', function() {

    it('should default true', function(done) {

      cli.confirm('true?', function(result) {
        result.should.equal(true);
        done();
      });
    });

    it('should default false', function(done) {

      cli.confirm('false?', false, function(result) {
        result.should.equal(false);
        done();
      });
    });

  });

  describe('chooseOne', function() {

    it('should return one', function(done) {

      cli.chooseOne('choose?', ['1', '2'], function(result) {
        result.should.equal('1');
        done();
      });
    });

  });

  describe('printAndExit', function() {

    var oldWrite = process.stdout.write;
    var oldExit = process.exit;
    var exitCode;
    var logged;

    before(function() {

      process.exit = (function() {
        return function(code) {
          exitCode = code;
        }
      })();

      oldWrite = process.stdout.write;
      process.stdout.write = (function(write) {
        return function(string, encoding, fd) {
          var args = Array.prototype.slice.call(arguments);
          logged += string;
        };
      }(process.stdout.write));

    });

    beforeEach(function() {
      logged = '';
      exitCode = undefined;
    });

    after(function() {
      process.stdout.write = oldWrite;
      process.exit = oldExit;
    });

    it('should log errors', function() {

      cli.printAndExit(new Error('test'));
      exitCode.should.equal(1);
    });

    it('should log strings', function() {

      cli.printAndExit(null, 'test');
      exitCode.should.equal(0);
      logged.should.equal('test\n');
    });

    it('should log simple objects', function() {

      cli.printAndExit(null, { test: 1 });
      exitCode.should.equal(0);
      logged.should.equal('test: 1\n\n');
    });

    it('should log complex objects', function() {

      cli.printAndExit(null, { test: { test: 1 } });
      exitCode.should.equal(0);
      logged.should.equal('test:\n  test: 1\n\n');
    });

    it('should hide passwords', function() {

      cli.printAndExit(null, { password: 1 });
      exitCode.should.equal(0);
      logged.should.equal("password: '******'\n\n");
    });

    describe('execute', function() {

      var executeNoError = function(arg1, cb) {
        cb(null, arg1);
      };

      it('should error if no command', function() {
        cli.execute(null, 'whatever')();
        exitCode.should.equal(1);
        logged.should.equal('[Error: missing command method]\n');
      });

      it("should error if arguments don't match", function() {

        cli.execute(executeNoError, 'whatever')();
        exitCode.should.equal(1);
        logged.should.equal('[Error: incorrect arguments]\n');
      });

      it('should print the result of the command', function() {

        cli.execute(executeNoError)(1);
        exitCode.should.equal(0);
        logged.should.equal('1\n');
      });

      it('should print the result with header', function() {

        cli.execute(executeNoError, 'whatever')(1);
        exitCode.should.equal(0);
        logged.should.equal('whatever\n========\n1\n');
      });

    });

  });

  describe('validate', function() {

    var helpCalled = false;
    var app = {
      commands: [
        { _name: '1' },
        { _name: '2' }
      ],
      help: function() {
        helpCalled = true;
      },
      rawArgs: new Array(3)
    };

    beforeEach(function() {
      helpCalled = false;
    });

    it('should do nothing if valid command', function() {

      app.rawArgs[2] = '1';
      cli.validate(app);
      helpCalled.should.be.false;
    });

    it('should error if invalid command', function() {

      app.rawArgs[2] = '3';
      cli.validate(app);
      helpCalled.should.be.true;
    });
  });

});
