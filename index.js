var format_fields_plugin = function (schema, plugin_options) {

    var getTagsFromOptions = function (name, options) {
        var requested_tags;
        if (options.tags) {
            requested_tags = options.tags;
        } else if (options.grants) {
            requested_tags = options.grants;
        } else if (options.type && options.type[0] && options.type[0].grants) {
            requested_tags = options.type[0].grants;
        } else if (options.type && options.type[0] && options.type[0].tags) {
            requested_tags = options.type[0].tags;
        } else {
            requested_tags = null;
        }

        if (requested_tags && !Array.isArray(requested_tags)) {
            requested_tags = [requested_tags];
        }

        return requested_tags;
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
                } else if (obj[name] && obj[name].constructor.name === 'ObjectID') {
                    type = 'other';
                } else if (Object.prototype.toString.call(obj[name]) === '[object Array]') {
                    type = 'array';
                } else if (Object.prototype.toString.call(obj[name]) === '[object Object]') {
                    type = 'object';
                } else {
                    type = 'other';
                }

                var field_name = (prefix) ? prefix + name : name;
                var value = getValueByType(field_name, obj[name], type, tags);

                if (value !== undefined) {
                    var output_name = schema.output_schema[field_name] || name;
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
            return undefined;
        }
    };

    var getValueByType = function (field_name, value, type, tags) {
        switch (type) {
            case 'array': {
                var tags_schema = schema.tags_schema[field_name];
                if (tags_schema && tags_schema.tags && isAllowed(tags_schema.tags, tags)) {
                    if (value[0] && value[0].constructor && value[0].constructor.name === 'ObjectID') {
                        return value;
                    } else if (Object.prototype.toString.call(value[0]) === '[object Object]') {
                        var array = [];
                        for (var i = 0; i < value.length; i++) {
                            array.push(manageObject(value[i], tags, field_name+'.$.', true));
                        }
                        return array;
                    } else {
                        return value;
                    }
                } else {
                    return undefined;
                }
            }
            case 'object': {
                var tags_schema = schema.tags_schema[field_name];
                if (tags_schema && tags_schema.instance === 'Mixed') {
                    if (tags_schema.tags && isAllowed(tags_schema.tags, tags)) {
                        return value;
                    } else {
                        return undefined;
                    }
                } else {
                    return manageObject(value, tags, field_name+'.');
                }
            }
            default: {
                var tags_schema = schema.tags_schema[field_name];
                if (tags_schema && tags_schema.tags && isAllowed(tags_schema.tags, tags)) {
                    return value;
                } else {
                    return undefined;
                }
            }
        }
    }

    var getTagsFromSchema = function (schema) {
        var tags_schema = {};
        for (var name in schema.paths) {
            var field = schema.paths[name];
            if ((field.instance === 'Array' || field.instance === 'Embedded')  && field.schema) {
                if (field.schema.options.grants || field.schema.options.tags) {
                    tags_schema[name] = {
                        tags: getTagsFromOptions(name, field.schema.options),
                        instance : field.instance
                    }
                }
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
                tags_schema[name] = {
                    tags     : getTagsFromOptions(name, opt),
                    instance : field.instance
                };
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
                output_schema[name] = opt.output || name.substr(name.lastIndexOf('.')+1);
            }
        }
        return output_schema;
    }

    schema.tags_schema = getTagsFromSchema(schema);
    schema.output_schema = getOutputFromSchema(schema);

    // deprecated
    schema.setGrantsSchema = function (grantsSchema) {
        return schema.addTagsSchema(grantsSchema);
    };

    // deprecated
    schema.setFieldGrants = function (field_name, grants) {
        return schema.setFieldTags(field_name, grants);
    };

    // deprecated
    schema.getFieldGrants = function (field_name) {
        return schema.tags_schema[field_name];
    };

    schema.addTagsSchema = function (tags_schema) {
        for (var name in tags_schema) {
            if (tags_schema.hasOwnProperty(name)) {
                let v = tags_schema[name];
                if (!schema.tags_schema[name]) {
                    schema.tags_schema[name] = {
                        tags: []
                    }
                }
                schema.tags_schema[name].tags = v;
            }
        }
        return schema;
    };

    schema.setFieldTags = function (field_name, tags) {
        if (!schema.tags_schema[field_name]) {
            schema.tags_schema[field_name] = {
                tags: []
            }
        }
        schema.tags_schema[field_name].tags = tags;
        return schema;
    };

    schema.getFieldTags = function (field_name) {
        return schema.tags_schema[field_name];
    };

    schema.addOutputSchema = function (output_schema) {
        Object.assign(schema.output_schema, output_schema);
        return schema;
    };

    schema.setFieldOutput = function (field_name, output) {
        schema.output_schema[field_name] = output;
        return schema;
    };

    schema.static('format', function (entity, tags) {
        if (!tags || !Array.isArray(tags))
            tags = [];

        tags.push('public');

        var obj = Object.assign({}, entity.toObject());
        return manageObject(obj, tags);
    });

    schema.methods.format = function (tags) {
        return schema.statics.format.call(this, this, tags);
    };
};

module.exports = format_fields_plugin;
