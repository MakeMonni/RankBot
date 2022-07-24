const Command = require("../core/command/command.js");
const Discord = require("discord.js");
const fetch = require('node-fetch');

class PlaylistUpdate extends Command {
    async run(client, message, args) {
        if (!message.attachments.array()[0]) {
            await message.channel.send("No attachment provided.")
            return;
        }
        const attachmentURL = message.attachments.array()[0].attachment;
        if (attachmentURL.endsWith(".json") || attachmentURL.endsWith(".bplist")) {
            let data;
            try {
                data = await fetch(`${attachmentURL}`).then(res => res.json());
            } catch (err) {
                await message.channel.send("Something went wrong downloading the playlist.")
                console.log(err)
            }

            let mapsUpdated = 0;
            let changelog = "";
            let errored = 0;
            let deleted = 0;

            // Add check for duplicate maps here.

            try {
                for (let i = 0; i < data.songs.length; i++) {
                    let mapHash = data.songs[i].hash;
                    let map = await client.beatsaver.findMapByHash(mapHash);

                    if (!map) {
                        errored++;
                        changelog += `${mapHash} could not be found.`
                        continue;
                    }
                    else if (mapHash !== map?.versions[0].hash) {
                        const oldVerIndex = map.versions.map(e => e.hash).indexOf(mapHash);
                        changelog += `${map.metadata.songAuthorName} - ${map.metadata.songName} by: ${map.metadata.levelAuthorName} \nOld: ${client.misc.formatedDate(map.versions[oldVerIndex].createdAt)} \nNew: ${client.misc.formatedDate(map.versions[0].createdAt)}\n-=-\n`;
                        mapsUpdated++;
                        data.songs[i].levelid = `custom_level_${map.versions[0].hash}`;
                        data.songs[i].hash = map.versions[0].hash;
                    }
                    if (map.deleted === true) {
                        deleted++;
                        changelog += `${map.metadata.songAuthorName} - ${map.metadata.songName} by: ${map.metadata.levelAuthorName} \n!!! DELETED !!!\nUploaded: ${client.misc.formatedDate(map.versions[0].createdAt)}\n-=-\n`;
                        if (args[0] === "clean") {
                            data.songs.splice(i, 1);
                        }
                    }
                }

                const playlistString = JSON.stringify(data, null, 2);
                const playlistBuffer = Buffer.from(playlistString, "utf-8");
                const changelogBuffer = Buffer.from(changelog, "utf-8");
                const changeLogAttachtment = new Discord.MessageAttachment(changelogBuffer, `changelog.txt`);
                const playlistAttachmet = new Discord.MessageAttachment(playlistBuffer, `${data.playlistTitle}.json`);


                let msg = `Updated your playlist.\nUpdated ${mapsUpdated} maps.`
                if(errored > 0) msg+= `\nFailed on ${errored} maps.`
                if(deleted > 0) msg+= `\nFound ${deleted} deleted maps.`
                if(deleted > 0 && args[0] !== "clean") msg += ` Run this command like this \`${client.config.prefix}playlistupdate clean\` to remove deleted maps.`
                
                let attachmentArray = [playlistAttachmet]
                if(changelog.length !== 0) attachmentArray.push(changeLogAttachtment)

                await message.channel.send(msg, attachmentArray);
            }
            catch (err) {
                await message.channel.send("Failed to update this playlist, make sure it is a correct playlist.")
                console.log(err);
            }

        }
        else {
            await message.channel.send("This is not a valid playlist data type. Supported types: json, bplist")
        }
    }
}
module.exports = PlaylistUpdate;