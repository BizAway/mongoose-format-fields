var mongoose = require('mongoose')
var assert = require('assert')
var Schema = mongoose.Schema
var ObjectId = mongoose.Schema.Types.ObjectId

var FormatFieldsPlugin = require('..')
var birthday = new Date()
describe('Testing with virtuals – mongooose-format-fields plugin', function () {
  var User
  var Role
  var Group
  
  before(function (done) {
    mongoose.connect('mongodb://localhost:27017/virtuals_formatfields', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })

    mongoose.deleteModel(/.*/);

    var RoleSchema = new Schema({
      name: {
        type: String,
        tags: ['owner', 'admin']
      },
      permits: [{
        type: String
      }]
    })

    var GroupSchema = new Schema({
        name: {
           type: String,
           tags: ['owner', 'admin']
        },
        description: {
            type: String,
            tags: ['owner']
        }
    });

    var UserSchema = new Schema({
      username: { type: String, tags: 'public' },
      email: { type: String, tags: ['owner', 'admin'] },
      password: { type: String },
      group_info: {
        is_admin: {
            type: Boolean,
            tags: ['owner', 'admin']
        },
        group_id: {
            type: ObjectId
        }
      },
      role_id: {
          type: ObjectId
      },
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

    UserSchema.virtual('role', {
      ref: 'Role',
      localField: 'role_id',
      foreignField: '_id',
      justOne: true
    })

    UserSchema.virtual('group_info.group', {
      ref: 'Group',
      localField: 'group_info.group_id',
      foreignField: '_id',
      justOne: true
    })

    UserSchema.plugin(FormatFieldsPlugin)
    RoleSchema.plugin(FormatFieldsPlugin)
    GroupSchema.plugin(FormatFieldsPlugin)

    UserSchema.addTagsSchema({
      'birthday': ['owner'],
      'address.city': ['owner', 'admin'],
      'address.nation': ['admin'],
      'aliases': ['owner'],
      'aliases.$.name': ['owner']
    })

    RoleSchema.addTagsSchema({
      permits: ['owner']
    })

    User = mongoose.model('User', UserSchema)
    Role = mongoose.model('Role', RoleSchema)
    Group = mongoose.model('Group', GroupSchema)

    var newGroup = {
        name: 'Best Group',
        description: 'The very Best Group'
    }

    var newRole = {
      name: 'Editor',
      permits: ['edit', 'view', 'reject']
    }

    var newUser = {
      username: 'pippo',
      email: 'pippo@pippo.com',
      password: 'abcd12456',
      group_info: {
        is_admin: true
      },
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

    Group.deleteMany({}, function (err) {
        assert.ifError(err)
        Role.deleteMany({}, function (err) {
          assert.ifError(err)
          User.deleteMany({}, function (err) {
              assert.ifError(err)
              Group.create(newGroup, function (err, group) {
                assert.ifError(err)
                assert.ok(group)
                Role.create(newRole, function (err, role) {
                  assert.ifError(err)
                  assert.ok(role)
          
                  newUser.role_id = role.id
                  newUser.group_info.group_id = group.id
                  User.create(newUser, function (error, user) {
                      assert.ifError(error)
                      assert.ok(user)
                      done()
                  })
                })
              })  
          })
        })
    })

  })

  after(function () {
    return mongoose.disconnect()
  })

  it('format the output based on tags of virtual fields .format([\'tag\'], { virtuals: true })', function (done) {
    User.findOne({ email: 'pippo@pippo.com' }).populate('role group_info.group').exec(function (err, doc) {
      assert.ifError(err)
      // ensure that we are loading the virtuals correctly
      assert.strictEqual('Editor', doc.role.name)
      assert.strictEqual('Best Group', doc.group_info.group.name)
      var formatted = doc.format(['owner'], { virtuals: true })
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
        }],
        role: {
          name: 'Editor',
          permits: ['edit', 'view', 'reject']
        },
        group_info: {
          is_admin: true,
          group: {
            name: 'Best Group',
            description: 'The very Best Group'
          } 
        }
      }
      assert.deepStrictEqual(formatted, expected)
      done()
    })
  })
})
