const fs = require("fs/promises")

class CommandLoader {
    static async loadCommands() {
        let retCommands = new Map();

        const commandFiles = await fs.readdir(`${process.cwd()}/commands`);
        for (const commandFile of commandFiles) {
            try {
                const command = require(`${process.cwd()}/commands/${commandFile}`)
                const commandName = commandFile.slice(0, commandFile.indexOf("."))
                retCommands.set(commandName, new command());
            } catch (err) {
                console.log(`Command ${commandFile} failed to load: ${err}`);
            }
        }

        return retCommands;
    }
}
module.exports = CommandLoader;