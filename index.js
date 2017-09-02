var util = require('util'),
    extend = require('extend'),
    dot = require('dot-object');

var format_fields_plugin = function (schema, plugin_options) {

    var getTagsFromOptions = function (name, options) {
        var requested_tags;
        if (options.tags) {
            requested_tags = options.tags;
        } else if (options.grants) {
            requested_tags = options.grants;
        } else {
            requested_tags = null;
        }

        if (requested_tags && !util.isArray(requested_tags)) {
            requested_tags = [requested_tags];
        }

        return requested_tags;
    };

    var getOutputFromOptions = function (name, options) {
        var output_field = name;
        return options.output || name;
    };

    var isAllowed = function (requested_tags, tags) {
        for (var n = 0; n < tags.length; n++) {
            if (requested_tags.indexOf(tags[n]) >= 0) {
                return true;
            }
        }
        return false;
    };

    var manageObject = function (obj, tags, prefix, return_always) {
        var output = {};
        for (var name in obj) {
            if (obj.hasOwnProperty(name)) {
                if (name === '_id') {
                    type = 'id';
                } else if (Object.prototype.toString.call(obj[name]) === '[object Array]') {
                    type = 'array';
                } else if (Object.prototype.toString.call(obj[name]) === '[object Object]') {
                    type = 'object';
                } else {
                    type = 'other';
                }
                var field_name = (prefix) ? prefix+name : name;
                var value = getValueByType(field_name, obj[name], type, tags);
                if (value !== undefined) {
                    var output_name = schema.output_schema[field_name] || field_name;
                    output[output_name] = value;
                }
            }
        }
        if (return_always) {
            return output;
        } else {
            if (Object.keys(output).length > 0) {
                return output;
            }
            return;
        }
    };

    var getValueByType = function (field_name, value, type, tags) {
        switch (type) {
            case 'array': {
                var array = [],
                    is_object_array = false;
                for (var i = 0; i < value.length; i++) {
                    var e = value[i];
                    if (Object.prototype.toString.call(e) === '[object Object]') {
                        is_object_array = true;
                        array.push(manageObject(e, tags, field_name+'.$.', true));
                    }
                }

                if (!is_object_array) {
                    var requested_tags = schema.tags_schema[field_name];
                    if (requested_tags && isAllowed(requested_tags, tags)) {
                        return value;
                    } else {
                        return undefined;
                    }
                } else {
                    return array;
                }
                break;
            }
            case 'object': {
                return manageObject(value, tags, field_name+'.');
            }
            default: {
                var requested_tags = schema.tags_schema[field_name];
                if (requested_tags && isAllowed(requested_tags, tags)) {
                    return value;
                } else {
                    return undefined;
                }
                break;
            }
        }
    }

    var getTagsFromSchema = function (schema) {
        var tags_schema = {};
        for (var name in schema.paths) {
            var field = schema.paths[name];
            if ((field.instance === 'Array' || field.instance === 'Embedded')  && field.schema) {
                var sub_tags_schema = getTagsFromSchema(field.schema);
                for (var sub_name in sub_tags_schema) {
                    var sep = (field.instance === 'Embedded') ? '.' : '.$.';
                    tags_schema[name+sep+sub_name] = sub_tags_schema[sub_name];
                }
            } else {
                var opt = field.options;
                if (name === '_id') {
                    opt.tags = (schema.options.id_grants) ? schema.options.id_grants : schema.options.id_tags;
                }
                tags_schema[name] = getTagsFromOptions(name, opt);
            }
        }
        return tags_schema;
    }

    var getOutputFromSchema = function (schema) {
        var output_schema = {};
        for (var name in schema.paths) {
            var field = schema.paths[name];
            if ((field.instance === 'Array' || field.instance === 'Embedded')  && field.schema) {
                var sub_output_schema = getOutputFromSchema(field.schema);
                for (var sub_name in sub_output_schema) {
                    var sep = (field.instance === 'Embedded') ? '.' : '.$.';
                    output_schema[name+sep+sub_name] = sub_output_schema[sub_name];
                }
            } else {
                var opt = field.options;
                if (name === '_id' && schema.options.id_output) {
                    opt.output = schema.options.id_output;
                }
                output_schema[name] = opt.output || name;
            }
        }
        return output_schema;
    }

    schema.tags_schema = getTagsFromSchema(schema);
    schema.output_schema = getOutputFromSchema(schema);

    // deprecated
    schema.setGrantsSchema = function (grantsSchema) {
        extend(schema.tags_schema, grantsSchema);
        return schema;
    };

    // deprecated
    schema.setFieldGrants = function (field_name, grants) {
        schema.tags_schema[field_name] = grants;
        return schema;
    };

    // deprecated
    schema.getFieldGrants = function (field_name) {
        return schema.tags_schema[field_name];
    };

    schema.addTagsSchema = function (tags_schema) {
        extend(schema.tags_schema, tags_schema);
        return schema;
    };

    schema.setFieldTags = function (field_name, tags) {
        schema.tags_schema[field_name] = tags;
        return schema;
    };

    schema.getFieldTags = function (field_name) {
        return schema.tags_schema[field_name];
    };

    schema.addOutputSchema = function (output_schema) {
        extend(schema.output_schema, output_schema);
        return schema;
    };

    schema.setFieldOutput = function (field_name, output) {
        schema.output_schema[field_name] = output;
        return schema;
    };

    schema.static('format', function (entity, tags) {
        if (!tags || !util.isArray(tags))
            tags = [];

        tags.push('public');

        var obj = extend({}, entity.toObject());
        return manageObject(obj, tags);
    });

    schema.methods.format = function (grants) {
        return schema.statics.format.call(this, this, grants);
    };
};

module.exports = format_fields_plugin;
