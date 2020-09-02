var mongoose = require('mongoose')
var assert = require('assert')
var Schema = mongoose.Schema
var ObjectId = mongoose.Schema.Types.ObjectId

var FormatFieldsPlugin = require('..')
var birthday = new Date()
describe('Testing legacy functions – mongooose-format-fields plugin', function () {
  var User

  before(function (done) {
    mongoose.connect('mongodb://localhost:27017/legacy_formatfields', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    
    mongoose.deleteModel(/.*/);

    var UserSchema = new Schema({
      username: { type: String, grants: 'public' },
      email: { type: String, grants: ['owner', 'admin'] },
      password: { type: String },
      birthday: {
        type: Date
      },
      address: {
        city: {
          type: String
        },
        nation: {
          type: String
        }
      },
      aliases: [mongoose.Schema({
        name: {
          type: String
        }
      })]
    })

    UserSchema.plugin(FormatFieldsPlugin)

    UserSchema.setGrantsSchema({
      'birthday': ['owner'],
      'address.city': ['owner', 'admin'],
      'address.nation': ['admin'],
      'aliases': ['owner'],
      'aliases.$.name': ['owner']
    })

    User = mongoose.model('User', UserSchema)

    var newUser = {
      username: 'pippo',
      email: 'pippo@pippo.com',
      password: 'abcd12456',
      birthday: birthday,
      address: {
        city: 'Spilimbergo',
        nation: 'Italy'
      },
      aliases: [{
        name: 'Pippuz'
      }, {
        name: 'Pippuccino'
      }]
    }

    User.deleteMany({}, function (err) {
      assert.ifError(err)
        User.create(newUser, function (error, user) {
          assert.ifError(error)
          assert.ok(user)
          done()
        })
      })
  })

  after(function () {
    return mongoose.disconnect()
  })

  it('format the output based on tags using format() (only \'public\' fields are shown)', function (done) {
    User.findOne({ email: 'pippo@pippo.com' }, function (err, doc) {
      assert.ifError(err)
      var formatted = doc.format()
      var expected = {
        username: 'pippo'
      }
      assert.deepStrictEqual(formatted, expected)
      done()
    })
  })

  it('format the output based on tags using format([\'tag\'])', function (done) {
    User.findOne({ email: 'pippo@pippo.com' }, function (err, doc) {
      assert.ifError(err)
      var formatted = doc.format(['owner'])
      var expected = {
        username: 'pippo',
        email: 'pippo@pippo.com',
        birthday: birthday,
        address: {
          city: 'Spilimbergo'
        },
        aliases: [{
          name: 'Pippuz'
        }, {
          name: 'Pippuccino'
        }]
      }
      assert.deepStrictEqual(formatted, expected)
      done()
    })
  })

  it('format the ouput of the fields tagged with Schema.setGrantsSchema()', function (done) {
    User.findOne({ email: 'pippo@pippo.com' }, function (err, doc) {
      assert.ifError(err)
      var formatted = doc.format(['admin'])
      var expected = {
        username: 'pippo',
        email: 'pippo@pippo.com',
        address: {
          city: 'Spilimbergo',
          nation: 'Italy'
        }
      }
      assert.deepStrictEqual(formatted, expected)
      done()
    })
  })
})
