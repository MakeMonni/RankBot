const Command = require("../core/command/command.js");

class Playlist extends Command {
    async run(client, message, args) {
        const playlistHelpMsg = `\nRandom <amount> (<filters>)\nRating <amount> <under/over> <rating value>\nBeatsage\nMapper <mapper name(s)>\nRanked (<under/over> <star value>)\n\nExample: \`${client.config.prefix}playlist ranked\`\n**[More info and examples.](<https://github.com/MakeMonni/RankBot/wiki/Commands#playlist>)**`;//\nNoodle\nMappinextensions

        if (args[0] === "help") {
            await message.channel.send("Playlist types:" + playlistHelpMsg);
            return;
        }

        else if (!args[0]) {
            await message.channel.send("No playlist type selected, use one of the following:" + playlistHelpMsg);
            return;
        }

        else if (args[0] === "random") {
            if (Number.isInteger(args[1]) || args[1] > 0) {
                if (args[1] > 10000) {
                    await message.channel.send("Sorry, max amount 10000");
                    return;
                }

                const amount = parseInt(args[1]);
                const filterArgs = args.slice(2);
                const filters = [];
                let url = ``

                const njsIndex = filterArgs.findIndex(e => e.toLowerCase().startsWith("njs:"));
                const npsIndex = filterArgs.findIndex(e => e.toLowerCase().startsWith("nps:"));
                const lengthIndex = filterArgs.findIndex(e => e.toLowerCase().startsWith("length:"));
                let err = false

                if (njsIndex !== -1) {
                    const split = filterArgs[njsIndex].split(":");
                    if ((split[1] === "under" || split[1] === "over") && split[2] > 0) {
                        filters.push("NJS");
                        url += `&njs=${split[2]}&njstype=${split[1]}`;
                    } else {
                        err = true;
                    }
                }
                if (npsIndex !== -1) {
                    const split = filterArgs[npsIndex].split(":");
                    if ((split[1] === "under" || split[1] === "over") && split[2] > 0) {
                        filters.push("NPS");
                        url += `&nps=${split[2]}&npstype=${split[1]}`;
                    }
                     else {
                        err = true;
                    }
                }
                if (lengthIndex !== -1) {
                    const split = filterArgs[lengthIndex].split(":");
                    if ((split[1] === "under" || split[1] === "over") && split[2] > 0) {
                        filters.push("Length");
                        url += `&length=${split[2]}&lengthtype=${split[1]}`;
                    } else {
                        err = true;
                    }
                }
                const res = await client.rankbotApi.apiCall(client.config.syncURL + `/random?a=${amount}${url}`);
                const playlistAttachment = await client.misc.jsonAttachmentCreator(res, "Random");
                const errMsg = `\nOne or more invalid arguments. Examples: \`njs:under:14 nps:over:11 length:under:60(in seconds)\``;
                let msg = ""
                if (filters.length > 0) msg += `Filtered by ${filters.join(", ")}.`;
                if (err || filterArgs.length > filters.length) msg += errMsg;
                await message.channel.send(`${message.author}, here is your random playlist. ${msg}`, playlistAttachment);

            }
            else {
                await message.channel.send(`That is not a valid amount maps. \nExample: \`${client.config.prefix}playlist random 25 (optional-> njs:under:14 nps:over:11 length:under:60(in seconds))\``);
            }
        }

        else if (args[0] === "rating") {
            if (!Number.isInteger(args[1]) && args[1] <= 0) {
                await message.channel.send(`That is not a valid amount maps. \nExample: \`${client.config.prefix}playlist rating 25 over 90(in %, true rating)\``);
                return;
            }
            if (args[1] > 10000) {
                await message.channel.send("Sorry, max amount 10000");
                return;
            }

            const amount = parseInt(args[1]);
            const type = args[2] === "over" ? "above" : args[2];
            const rating = args[3];

            if (type !== "above" && type !== "under" || isNaN(rating)) {
                await message.channel.send(`Invalid arguments. \nExample: \`${client.config.prefix}playlist rating 25 over 90\``);
                return;
            }

            const res = await client.rankbotApi.apiCall(client.config.syncURL + `/rating?a=${amount}&r=${rating}&u=${type}&m=5`);
            const playlistAttachment = await client.misc.jsonAttachmentCreator(res, "Rating");
            await message.channel.send(`${message.author}, here is your rating playlist with ${amount} maps rated ${args[2]} ${rating}%.`, playlistAttachment);
        }

        else if (args[0] === "beatsage") {
            const maps = await client.db.collection("beatSaverLocal").find({ automapper: true }).toArray();
            let mapHashes = await hashes(maps);

            const playlistAttachment = await client.misc.createPlaylist("BeatSage", mapHashes, "https://cdn.discordapp.com/attachments/840144337231806484/878784455798554645/abNYFk3F.png", undefined, "Beatsage maps, for some reason")
            await message.channel.send(`${message.author}, here is your BeatSage playlist, idk why you want this but here you go.\nIt has ${maps.length} maps.`, playlistAttachment);
        }

        /*
        else if (args[0] === "noodle") {
            const maps = await client.db.collection("beatSaverLocal").find({ 'versions.diffs.ne': true }).toArray();
            let mapHashes = await hashes(maps);

            const playlistAttachment = await client.misc.createPlaylist("Noodle", mapHashes, "https://cdn.discordapp.com/attachments/840144337231806484/878789530642165780/unknown.png")
            await message.channel.send(`${message.author}, Enjoy burning your eyes.\nIt has ${maps.length} maps.`, playlistAttachment);
        }

        else if (args[0] === "mappingextensions") {
            const maps = await client.db.collection("beatSaverLocal").find({ 'versions.diffs.me': true }).toArray();
            let mapHashes = await hashes(maps);

            const playlistAttachment = await client.misc.createPlaylist("MappingExtensions", mapHashes, "https://cdn.discordapp.com/attachments/840144337231806484/878792455531675689/11307S9moa6gkjIHScIMauCLmyLBOjsL1d7wO9-uSn48T0oQnqmJ3tKl6-7ZNV7kbFHcl2_KbgAUc1V0J7ti9J3gmoMTgH6w.png")
            await message.channel.send(`${message.author}, Feeling oldschool eh?\nIt has ${maps.length} maps.`, playlistAttachment);
        }*/

        else if (args[0] === "mapper") {
            if (!args[1]) {
                await message.channel.send(`No mapper provided.\nExample: \`${client.config.prefix}playlist mapper ETAN Joshabi\``);
                return;
            }

            let syncMappers = "";
            let allMaps = [];
            let playlistDescription = "Playlist has maps from ";

            // TODO: Fix this spaghetti

            for (let i = 0; i <= args.length - 2; i++) {
                const search = args[i + 1].replaceAll(`_`, ` `);
                const maps = await client.db.collection("beatSaverLocal").find({ "metadata.levelAuthorName": { $regex: `^${search}$`, $options: "i" } }).toArray();
                if (maps.length == 0) {
                    //add similar result suggestion here
                    await message.channel.send(`Found no maps from mapper: ${args[i + 1]}`);
                    return;
                }
                syncMappers += args[i + 1] + ","
                playlistDescription += `\n${args[i + 1]}`
                allMaps.push(...maps);
            }
            let mapHashes = await hashes(allMaps);
            syncMappers = syncMappers.slice(0, -1);

            let playlistName;
            if (args.length - 2 >= 1) {
                playlistName = "VariousMappers"
            }
            else {
                playlistName = syncMappers;
            }

            const playlistAttachment = await client.misc.createPlaylist(playlistName, mapHashes, allMaps[0].versions[0].coverURL, `${client.config.syncURL}/mapper?t=${syncMappers}`, playlistDescription);
            await message.channel.send(`${message.author}, Here is your maps by ${playlistName}\nIt has ${allMaps.length} maps.`, playlistAttachment, playlistDescription);
        }

        else if (args[0] === "ranked") {

            let hashlist = [];
            let maps = [];

            if (args[1] === "ordered") {
                const res = await client.rankbotApi.apiCall(client.config.syncURL + "/ranked?t=ordered");
                const attachment = await client.misc.jsonAttachmentCreator(res, "OrderedRanked");
                await message.channel.send("Here is your ordered playlist with ranked maps.", attachment);
                return;
            }
            else if (args[1] === "over" || args[1] === "under") {

                if (isNaN(args[2])) {
                    message.channel.send(`Invalid arguments.\nExample: \`${client.config.prefix}playlist ranked under 9\``);
                    return;
                }
                let finder;
                if (args[1] === "over") {
                    finder = { stars: { $gt: +args[2] } }
                }
                else {
                    finder = { stars: { $lt: +args[2] } }
                }
                maps = await client.db.collection("scoresaberRankedMaps").find(finder).toArray();
            }

            else {
                const res = await client.rankbotApi.apiCall(client.config.syncURL + "/ranked");
                const attachment = await client.misc.jsonAttachmentCreator(res, "ranked");
                await message.channel.send("Here is your playlist with ranked maps.", attachment);
                return;
            }

            for (let i = 0; i < maps.length; i++) {
                const mapHash = { hash: maps[i].hash }
                if (!hashlist.some(e => e.hash === maps[i].hash)) hashlist.push(mapHash);
            }

            let playlistAttatchment = await client.misc.createPlaylist("Ranked", hashlist, "https://cdn.discordapp.com/attachments/840144337231806484/880192078217355284/750250421259337748.png", ``, "Ranked maps");
            await message.channel.send("Here is your playlist with ranked maps.", playlistAttatchment);
        }

        else {
            await message.channel.send("Not a valid playlist type, use one of the following:" + playlistHelpMsg);
        }
    }
}
module.exports = Playlist;

async function hashes(maps) {
    let mapHashes = [];
    for (let i = 0; i < maps.length; i++) {
        let songhash = {}
        if (maps[i]?.versions[0]?.hash) {
            songhash = { hash: maps[i]?.versions[0].hash }
            mapHashes.push(songhash)
        }
    }
    return mapHashes;
}