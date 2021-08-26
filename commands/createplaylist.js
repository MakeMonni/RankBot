const Command = require("../core/command/command.js");

class CreatePlaylist extends Command {
    async run(client, message, args) {
        if (args.length === 0) {
            message.channel.send("No name or maps provided.");
            return;
        }
        const args_maps = args[0].split("\n")
        if (args_maps.length <= 1) {
            message.channel.send("No maps provided.");
            return;
        }

        let playlistImage = "";

        let mapHashes = [];
        for (let i = 1; i < args_maps.length; i++) {
            if (args_maps[args_maps.length - 1].startsWith("https://") && i === args_maps.length - 1) {
                playlistImage = args_maps[args_maps.length - 1];
            }
            else {
                if (client.beatsaver.isKey(args_maps[i])) {
                    const map = await client.beatsaver.findMapByKey(args_maps[i]);
                    const songhash = { hash: map.versions[0].hash }
                    mapHashes.push(songhash)
                }
            }
        }
        const playlistAttachment = await client.misc.createPlaylist(args_maps[0], mapHashes, playlistImage);
        await message.channel.send(`${message.author}, here is your playlist.`, playlistAttachment);
    }
}
module.exports = CreatePlaylist;