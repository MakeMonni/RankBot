const Command = require("../core/command/command.js");

class Playlist extends Command {
    async run(client, message, args) {
        if (args[0] === "help") {
            await message.channel.send(`Playlist types: \nRandom\nBeatsage\nMapper\nRanked\n\nExample: \`${client.config.prefix}playlist ranked\``) //\nNoodle\nMappinextensions
        }

        else if (!args[0]) {
            await message.channel.send("No playlist type selected. Pick one of the following.\nRandom\nBeatsage\nMapper\nRanked")
            return; // \nNoodle\nMappingextensions
        }

        else if (args[0] === "random") {
            if (Number.isInteger(args[1]) || args[1] > 0) {
                if (args[1] > 1000) {
                    await message.channel.send("Sorry, max amount 1000");
                    return;
                }
                let amount = parseInt(args[1]);
                const maps = await client.db.collection("beatSaverLocal").aggregate([{ $match: { automapper: false } }, { $sample: { size: amount } }]).toArray();
                const mapHashes = await hashes(maps);

                const playlistAttachment = await client.misc.createPlaylist("RandomPlaylist", mapHashes, "https://cdn.discordapp.com/attachments/818358679296147487/844607045130387526/Banana_Dice.jpg")
                await message.channel.send(`${message.author}, here is your random playlist. :)`, playlistAttachment);
            }
            else {
                await message.channel.send(`That is not a valid amount maps for a playlist. \nExample: \`${client.config.prefix}playlist random 25\``);
            }
        }

        else if (args[0] === "beatsage") {
            const maps = await client.db.collection("beatSaverLocal").find({ automapper: true }).toArray();
            let mapHashes = await hashes(maps);

            const playlistAttachment = await client.misc.createPlaylist("BeatSage", mapHashes, "https://cdn.discordapp.com/attachments/840144337231806484/878784455798554645/abNYFk3F.png")
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
                await message.channel.send("No mapper provided")
                return;
            }
            const maps = await client.db.collection("beatSaverLocal").find({ "metadata.levelAuthorName": { $regex: `^${args[1]}$`, $options: "i" } }).toArray();

            console.log(maps[0]);

            let mapHashes = await hashes(maps);

            const playlistAttachment = await client.misc.createPlaylist(args[1], mapHashes, maps[0].versions[0].coverURL);
            await message.channel.send(`${message.author}, Here is your maps by ${args[1]}\nIt has ${maps.length} maps.`, playlistAttachment);
        }

        else if (args[0] === "ranked") {
            const maps = await client.db.collection("scoresaberRankedMaps").find({}).toArray();

            let hashlist = [];
            for (let i = 0; i < maps.length; i++) {
                const mapHash = { hash: maps[i].hash }
                if (!hashlist.some(e => e.hash === maps[i].hash)) hashlist.push(mapHash);
            }

            let playlistAttatchment = await client.misc.createPlaylist("Ranked", hashlist, "https://cdn.discordapp.com/attachments/840144337231806484/880192078217355284/750250421259337748.png");
            await message.channel.send("Here is your playlist with all ranked maps.", playlistAttatchment);
        }

        else {
            await message.channel.send(`Not a valid play category, use ${client.config.prefix}playlist help`)
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