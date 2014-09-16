mongoose-format-fields
======================

A plugin for [Mongoose](https://github.com/LearnBoost/mongoose) that formats the output of a model depending on the grants allowed.
This plugins is really usefull for the creation of APIs.

## Installation

`npm install mongoose-format-fields`

## Usage

Here an example how to use this plugin. You must first implement the plugin on your model and then you can start to add the parameter `grants` to your schema fields.
You can use your own words and criteria. It accepts a single string or an array of string.

```javascript
var format_fields = require('mongoose-format-fields');
var UserSchema = new Schema({
    username: {type: String, grants: 'public' },
    email: {type: String, grants: ['owner', 'admin'] },
    password: {type: String } // never show on the outputs
});
UserSchema.plugin(format_fields);
mongoose.model('User', UserSchema);
```

Your model now has the additional built-in method `format()`.

```javascript
var User = mongoose.model('User');
User.findOne({ username: 'example' }, function (err, user) {
    var output_public = user.format();
    console.log(output_public); // will output only fields with the public grant

    var output_owner = user.format(['owner']);
    console.log(output_owner); // will output only fields with the public and owner grant

    var output_admin = user.format(['admin']);
    console.log(output_admin); // will output only fields with the public and admin grant

    var output_admin_owner = user.format(['admin', 'owner']);
    console.log(output_admin_owner); // will output only fields with the public, admin and owner grant
});
```

The parameter `grants` can be implemented not only on every fields configuration but also on a Schema configuration like the example:

```javascript
var format_fields = require('mongoose-format-fields');

var EmailSchema = mongoose.Schema({
    "email": {type: String, required: true}
}, { id: false, _id: false, grants: ['owner', 'admin'] });

var UserSchema = new Schema({
    username: {type: String, grants: 'public' },
    emails: [EmailSchema],
    password: {type: String } // never show on the outputs
});
UserSchema.plugin(format_fields);
mongoose.model('User', UserSchema);
```

### ID grants

Mongoose by default automatically add for every schema the id field that normally is output as `_id`.
This plugin allows you to add also the possibility to put grants on the id field adding the `id_grants` to your Schema configuration like in the example below:

```javascript
var UserSchema = mongoose.Schema({
    username: {type: String, grants: 'public' },
    email: {type: String, grants: ['owner', 'admin'] },
    password: {type: String } // never show on the outputs
}, { id_grants: 'public' });
```

If you think like me that the output format of the id as `_id` is not so fancy, with this plugin you can also decide the output name simply adding the `id_output` parameter to your Schema configuration.

```javascript
var UserSchema = mongoose.Schema({
    username: {type: String, grants: 'public' },
    email: {type: String, grants: ['owner', 'admin'] },
    password: {type: String } // never show on the outputs
}, { id_grants: 'public', id_output: 'id' // or any name you want });
```