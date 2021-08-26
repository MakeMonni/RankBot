const Command = require("../core/command/command.js");

class CreatePlaylist extends Command {
    async run(client, message, args) {
        if (args.length === 0) {
            await message.channel.send(`No name or maps provided. Example: \`\`\`\n${client.config.prefix}createplaylist playlistname\n1\n25f\n6666\`\`\``);
            return;
        }
        const args_maps = args[0].split("\n")
        if (args_maps.length <= 1) {
            await message.channel.send(`No maps provided. Example: \`\`\`\n${client.config.prefix}createplaylist playlistname\n1\n25f\n6666\`\`\``);
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