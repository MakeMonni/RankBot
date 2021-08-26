const Command = require("../core/command/command.js");
const Discord = require("discord.js");
const fetch = require('node-fetch');

class PlaylistInfo extends Command {
    async run(client, message, args) {
        const attachmentURL = message.attachments.array()[0].attachment;
        if (attachmentURL.endsWith(".json") || attachmentURL.endsWith(".bplist")) {
            let data;
            try {
                data = await fetch(`${attachmentURL}`).then(res => res.json());
            } catch (err) {
                message.channel.send("Something went wrong downloading the playlist.")
                console.log(err)
            }

            let mapInfo = "Playlistdata:\n";
            for (let i = 0; i < data.songs.length; i++) {
                let mapHash = data.songs[i].hash;

                let map = await client.beatsaver.findMapByHash(mapHash);

                if (!map) {
                    mapInfo = mapInfo + (`Could not find map ${data.songs[i].hash}\n-=-\n`)
                }
                else {
                    mapInfo = mapInfo + (`${map.metadata.songName} ${map.metadata.songSubName} - ${map.metadata.songAuthorName} by ${map.metadata.levelAuthorName}\nKey: ${map.key} | BPM: ${map.metadata.bpm}`);
                    if (data.songs[i]?.difficulties !== undefined) {
                        const versionIndex = map.versions.findIndex(versions => versions.hash === data.songs[i].hash.toUpperCase());
                        const difficultyData = map.versions[versionIndex]?.diffs.find(e => e.characteristic === client.beatsaver.findPlayCategory(data.songs[i].difficulties[0].characteristic) && e.difficulty === client.beatsaver.convertDiffNameBeatSaver(data.songs[i].difficulties[0].name));

                        if (!difficultyData) mapInfo = mapInfo + `\nBut map did not have difficulty ${data.songs[i].difficulties[0].name}...`;
                        else mapInfo = mapInfo + ` | NJS: ${difficultyData.njs} | NPS: ${Math.round(difficultyData.notes / difficultyData.length * 100) / 100} | ${data.songs[i].difficulties[0].characteristic}-${client.beatsaver.convertDiffNameVisual(data.songs[i].difficulties[0].name)}`;
                    }
                    mapInfo = mapInfo + `\n-=-\n`;
                }
            }
            const mapInfoBuffer = Buffer.from(mapInfo, "utf-8");
            const mapInfoAttachment = new Discord.MessageAttachment(mapInfoBuffer, `Playlist_${data.playlistTitle}_Info.txt`);

            message.channel.send("Here is your info :)", mapInfoAttachment);
        }
        else {
            message.channel.send("This is not a valid playlist data type. Supported types: json, bplist")
        }
    }
}
module.exports = PlaylistInfo;