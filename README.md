mongoose-format-fields
======================

A plugin for [Mongoose](https://github.com/LearnBoost/mongoose) that formats the output of a model depending on the tags associated.

## Installation

`npm install mongoose-format-fields`

## Usage
You must first implement the plugin on your model and then you can start to add the `tags` attribute to your field options. You can also set tags rules at schema level, check other examples below.
You can use your own words and criteria. It accepts a single string or an array of string.

```javascript
var format_fields = require('mongoose-format-fields');
var UserSchema = new Schema({
    username: {type: String, tags: 'public' }, // tags as a single string
    email: {type: String, tags: ['owner', 'admin'] }, // tags as array
    password: {type: String } // no tags, will never be showed
});
UserSchema.plugin(format_fields);
```

Your model now has the additional built-in method `format()` that returns a new object with only the fields that match the input tags.

```javascript
var User = mongoose.model('User');
User.findOne({ username: 'example' }, function (err, user) {
    var output_public = user.format();
    console.log(output_public); // will output only fields with the public tag

    var output_owner = user.format(['owner']);
    console.log(output_owner); // will output only fields with the public and owner tag

    var output_admin = user.format(['admin']);
    console.log(output_admin); // will output only fields with the public and admin tag

    var output_admin_owner = user.format(['admin', 'owner']);
    console.log(output_admin_owner); // will output only fields with the public, admin and owner tag
});
```
## Examples

The parameter `tags` can be set at field level or at schema level.
Use the dot notation to refer to subdocuments and the `$` to refer to arrays like in the example below.

```javascript
var format_fields = require('mongoose-format-fields');

var UserSchema = new Schema({
    username: {type: String, tags: ['public'] }, // tags on field level
    is_active: {type: Boolean},
    settings: {
        my_setting: {type: Boolean}
    },
    emails: [mongoose.Schema({
        email: {type: String}
    }],
    password: {type: String } // never show on the outputs
});
UserSchema.plugin(format_fields);

// Add tags at schema level
UserSchema.addTagsSchema({
    '_id': ['owner'], // add tags also to the buit-in _id field
    'is_active': ['owner'],
    'settings.my_setting': ['owner'], // add tags to subdocuments
    'emails.$.email': ['public'] // add tags to a subdocument field
});
```
