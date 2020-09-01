var mongoose = require('mongoose');
var assert = require('assert');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

var FormatFieldsPlugin = require('../');
var birthday = new Date();
describe('mongooose-format-fields plugin', function () {
    var User;
    var Role;

    before(function (done) {
        mongoose.connect('mongodb://localhost:27017/formatfields', {
          useNewUrlParser: true,
          useUnifiedTopology: true
        });

        var RoleSchema = new Schema({
            name: {
                type: String,
                grants: ['owner', 'admin']
            },
            permits: [{
                type: String
            }]
        });

        var UserSchema = new Schema({
            username: {type: String, tags: 'public' },
            email: {type: String, tags: ['owner', 'admin'] },
            password: {type: String },
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
        });

        UserSchema.virtual('role', {
            ref: 'Role',
            localField: 'role_id',
            foreignField: '_id',
            justOne: true,
            tags: ['owner']
        });

        UserSchema.plugin(FormatFieldsPlugin);
        RoleSchema.plugin(FormatFieldsPlugin);

        UserSchema.addTagsSchema({
            'birthday': ['owner'],
            'address.city': ['owner', 'admin'],
            'address.nation': ['admin'],
            'aliases': ['owner'],
            'aliases.$.name': ['owner']
        });

        RoleSchema.setGrantsSchema({
            'permits': ['owner']
        });
        
        User = mongoose.model('User', UserSchema);
        Role = mongoose.model('Role', RoleSchema);

        var newRole = {
            name: 'Editor',
            permits: ['edit', 'view', 'reject']
        };

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
        };

        Role.deleteMany({}, function (err) {
            assert.ifError(err);
            User.deleteMany({}, function (err) {
                assert.ifError(err);

                Role.create(newRole, function (err, role) {
                    assert.ifError(err);
                    assert.ok(role);
                    
                    newUser.role_id = role.id;
                    User.create(newUser, function(error, user) {
                        assert.ifError(error);
                        assert.ok(user);
                        done();
                      });
                });
           });
        });


    });

    after(function() {
        return mongoose.disconnect();
    });

    it('format the output based on tags using format() (only \'public\' fields are shown)', function (done) {

        User.findOne({ email: 'pippo@pippo.com' }, function (err, doc) {
            assert.ifError(err);
            var formatted = doc.format();
            var expected = {
                username: 'pippo'
            };
            assert.deepStrictEqual(formatted, expected);
            done();
        });
    });

    it('format the output based on tags using format([\'string\'])', function (done) {

        User.findOne({ email: 'pippo@pippo.com' }, function (err, doc) {
            assert.ifError(err);
            var formatted = doc.format(['owner']);
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
            };
            assert.deepStrictEqual(formatted, expected);
            done();
        });
    });


    it('format the ouput of the fields tagged with Schema.addTagsSchema()', function(done) {
        User.findOne({ email: 'pippo@pippo.com' }, function (err, doc) {
            assert.ifError(err);
            var formatted = doc.format(['admin']);
            var expected = {
                username: 'pippo',
                email: 'pippo@pippo.com',
                address: {
                    city: 'Spilimbergo',
                    nation: 'Italy'
                }
            };
            assert.deepStrictEqual(formatted, expected);
            done();
        });
    });

    it('format the output based on tags of virtual fields', function (done) {

        User.findOne({ email: 'pippo@pippo.com' }).populate('role').exec(function (err, doc) {
            assert.ifError(err);
            // ensure that we are loading the virtuals correctly
            assert.strictEqual('Editor', doc.role.name);
            var formatted = doc.format(['owner']);
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
                }
            };
            assert.deepStrictEqual(expected, formatted);
            assert.doesNotThrow(function () {
                var roleName = formatted.role.name;
                return roleName;
            });
            done();
        });
    });

    it('[LEGACY] format the output using the old "grants" schema key and functions', function (done) {
        Role.findOne({ name: 'Editor' }, function (err, role) {
            var formatted = role.format(['admin']);

            assert.strictEqual('Editor', formatted.name);
            assert.notDeepStrictEqual(['edit', 'view', 'reject'], formatted.permits);
            done();
        });
    }); 
});

