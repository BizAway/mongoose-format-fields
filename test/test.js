var mongoose = require('mongoose');
var assert = require('assert');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Schema.Types.ObjectId;

var FormatFieldsPlugin = require('../');

describe('mongooose-format-fields plugin', function () {
    var User;
    var Role;

    before(function (done) {
        mongoose.connect('mongodb://localhost:27017/formatfields', {
          useNewUrlParser: true,
          useUnifiedTopology: true
        });

        var birthday = new Date();

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
            'address.nation': ['owner', 'admin'],
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

    it('format the output based on tags using format(\'string\')', function (done) {

        User.findOne({ email: 'pippo@pippo.com' }, function (err, doc) {
            assert.ifError(err);
            var formatted = doc.format('public');
            assert.equal('pippo', formatted.username);
            assert.notEqual('pippo@pippo.com', formatted.email);
            assert.notEqual('abcd12456', formatted.password);
            done();
        });
    });

    it('format the output based on tags using format([\'string\'])', function (done) {

        User.findOne({ email: 'pippo@pippo.com' }, function (err, doc) {
            assert.ifError(err);
            var formatted = doc.format(['public', 'owner']);
            assert.equal('pippo', formatted.username);
            assert.equal('pippo@pippo.com', formatted.email);
            assert.notEqual('abcd12456', formatted.password);
            done();
        });
    });


    it('format the ouput of the fields tagged with Schema.addTagsSchema()', function(done) {
        User.findOne({ email: 'pippo@pippo.com' }, function (err, doc) {
            assert.ifError(err);
            var formatted = doc.format(['public', 'owner']);
            assert.equal('Spilimbergo', formatted.address.city);
            assert.equal('Pippuz', formatted.aliases[0].name);
            assert.notEqual('abcd12456', formatted.password);
            done();
        });
    });

    it('format the output based on tags of virtual fields', function (done) {

        User.findOne({ email: 'pippo@pippo.com' }).populate('role').exec(function (err, doc) {
            assert.ifError(err);
            // ensure that we are loading the virtuals correctly
            assert.equal('Editor', doc.role.name);
            var formatted = doc.format(['public', 'owner']);
            assert.notEqual('abcd12456', formatted.password);
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

