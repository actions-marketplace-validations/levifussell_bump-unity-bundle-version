
const fs = require('fs');
const yaml = require('js-yaml');
const core = require('@actions/core');

const file = core.getInput('file');
const regex = core.getInput('regex');
const bump_major = core.getInput('major') === 'true' || core.getInput('major') > 0;
const bump_minor = core.getInput('minor') === 'true' || core.getInput('minor') > 0;
const bump_patch = core.getInput('patch') === 'true' || core.getInput('patch') > 0;


/// run
async function run()
{
    try
    {
        const [doc, schema] = parse_unityfile(file);
        console.dir({doc: doc})
        if (doc[0].PlayerSettings.bundleVersion)
        {
            const ver = parse_version(doc[0].PlayerSettings.bundleVersion);
            if (ver)
            {
                let [major, minor, patch, prerelease, buildmetadata] = ver;
                console.dir({ver});
                console.dir({major, minor, patch, prerelease, buildmetadata});
                console.dir({bump_major, bump_minor, bump_patch});

                if (bump_major)
                {
                    major++;
                }
                if (bump_minor)
                {
                    minor++;
                }
                if (bump_patch)
                {
                    patch++;
                }
                doc[0].PlayerSettings.bundleVersion = `${major}.${minor}.${patch}`;

                if (prerelease)
                {
                    doc[0].PlayerSettings.bundleVersion += `-${prerelease}`;
                }
                if (buildmetadata)
                {
                    doc[0].PlayerSettings.bundleVersion += `+${buildmetadata}`;
                }

                write_unityfile(doc, file, schema);
            }
            else
            {
                core.setFailed(`failed to parse ${file} bundleVersion`);
            }
        }
        else
        {
            core.setFailed(`invalid ${file} does not contain version`);
        }

        // read back
        const [doc2, schema2] = parse_unityfile(file);
        console.dir({doc2: doc2})
        console.dir(doc2[0].PlayerSettings)
        if (doc2[0].PlayerSettings.bundleVersion)
        {
            const ver = parse_version(doc2[0].PlayerSettings.bundleVersion);
            if (ver)
            {
                core.setOutput('version', doc2[0].PlayerSettings.bundleVersion);
            }
            else
            {
                core.setFailed(`failed to parse ${file} version`);
            }

            if (doc2[0].PlayerSettings.bundleVersion === doc[0].PlayerSettings.bundleVersion)
            {
                // no issues
            }
            else
            {
                core.setFailed("readback version different from input version");
            }
        }
        else
        {
            core.setFailed(`invalid ${file} does not contain version`);
        }
    }
    catch (error)
    {
        core.setFailed(error.message);
    }
}

function parse_version(version)
{
    const match = version.match(regex);
    if (match)
    {
        console.dir({groups: match.groups});
        return [match.groups.major, match.groups.minor, match.groups.patch, match.groups.prerelease, match.groups.buildmetadata];
    }
    return null
}

function parse_unityfile(path)
{
    const types = {};
    let file = fs.readFileSync(path, 'utf8');

    // remove the unity tag line
    file = file.replace( /%TAG.+\r?\n?/, '' );

    // replace each subsequent tag with the full line + map any types
    file = file.replace( /!u!([0-9]+).+/g, ( match, p1 ) => {
        // create our mapping for this type
        if ( !( p1 in types ) )
        {
            const type = new yaml.Type( `tag:unity3d.com,2011:${p1}`, {
                kind: 'mapping',
                construct: function ( data ) {
                    return data || {}; // in case of empty node
                },
                instanceOf: Object
            } );
            types[p1] = type;
        }

        return `!<tag:unity3d.com,2011:${p1}>`
    });
    //console.log("fixedup string\n", file)

    // create our schema
    const schema = yaml.DEFAULT_SCHEMA.extend(Object.values(types));

    // parse our yaml
    const objAr = yaml.loadAll(file, null, { schema });

    return [objAr, schema];
}

function write_unityfile(objAr, path, schema)
{
    let str = "%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!129 &1\n"
    objAr.forEach(element => {
        str += yaml.dump(element, null, { schema: schema }); //noArrayIndent: true, flowLevel: -1,
    });
    str = str.replace(/(null)/g, '');
    fs.writeFileSync(path, str);
}

run()
