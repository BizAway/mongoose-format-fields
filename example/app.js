var mongoose = require('mongoose'),
    format_fields = require('../index');

var p = mongoose.connect('mongodb://localhost:27017/test',{
    useMongoClient: true
});

var SomethingSchema = mongoose.Schema({
    'hello': {
        type: String,
        tags: ['public']
    },
    'hello2': {
        type: String,
        tags: ['owner'],
        output: 'HELLO2'
    }
});

var AddressSchema = mongoose.Schema({
    'street': {
        type: String,
        tags: ['owner']
    },
    'city': {
        type: String,
        tags: ['public']
    },
    'country': {
        type: String,
        tags: ['public']
    },
    'is_public': {
        type: Boolean,
        default: true,
        tags: ['public']
    },
    'something': [SomethingSchema]
}, {
    id_tags: 'public',
    id_output: 'ID'
});

var UserSchema = mongoose.Schema({
    'first_name': {
        type: String,
        tags: ['public'],
        output: 'FIRST_NAME',
    },
    'last_name': {
        type: String,
    },
    'email': {
        type: String,
        tags: ['public']
    },
    'settings': {
        'sub1': {
            'show_profile': {
                type: Boolean,
                tags: ['public'],
                output: 'SHOW_PROFILE'
            }
        },
        'show_profile': {
            type: Boolean,
            tags: ['public']
        }
    },
    'labels': [{
        type: String,
        tags: ['public']
    }],
    'address': AddressSchema,
    'addresses': [AddressSchema]
});

UserSchema.plugin(format_fields);
UserSchema.addTagsSchema({
    '_id': ['public']
});
UserSchema.addOutputSchema({
    '_id': 'id'
});

mongoose.model('User', UserSchema);

p.then(function(db) {
    var User = db.model('User');
    var user = new User({
        first_name: 'Flavio',
        last_name: 'Del Bianco',
        email: 'info@flaviodelbiaco.com',
        settings: {
            sub1: {
                show_profile: false
            },
            show_profile: true
        },
        labels: ['label1', 'label2'],
        address: {
            street: 'Wall Street 125',
            city: 'New York',
            country: 'US',
            something: [{
                hello: 'siii hello',
                hello2: 'siii hello2'
            }]
        },
        addresses: [
            {
                street: 'Wall Street 125',
                city: 'New York',
                country: 'US',
                something: [{
                    hello: 'siii hello',
                    hello2: 'siii hello2'
                }]
            },
            {
                street: 'Via della stazione',
                city: 'Roma',
                country: 'IT'
            }
        ]
    });
    console.log('---- Public output');
    console.log(require('util').inspect(user.format(), { depth: null }));
    console.log('---- Owner output');
    console.log(require('util').inspect(user.format(['owner']), { depth: null }));
    process.exit();
}, function (err) {
    console.log(err);
});
