const Command = require("../core/command/command.js");

class HMD extends Command {
    async run(client, message, args) {
        const listOfHMD = client.config.hmdList;
            if (args[0]?.toLowerCase() === `help` || !args[0]) {
                let string = "\n";
                for (let i = 0; i < listOfHMD.length; i++) {
                    string = string + listOfHMD[i] + "\n"
                }
                message.channel.send("Here is a list of available HMD" + string);
                return;
            }

            let foundHMD = 0;
            let noFoundHMD = [];
            for (let i = 0; i < args.length; i++) {
                if (listOfHMD.map(x => x.toLowerCase()).includes(args[i].toLowerCase())) {
                    foundHMD++;
                    let hmdNameIndex = listOfHMD.map(x => x.toLowerCase()).findIndex(e => e === args[i].toLowerCase());
                    let role = message.guild.roles.cache.filter(role => role.name === listOfHMD[hmdNameIndex]).first();
                    if (role === undefined) {
                        console.log(`Role ${listOfHMD[hmdNameIndex]} did not exist. Creating.`);

                        await message.guild.roles.create({
                            data: {
                                name: listOfHMD[hmdNameIndex]
                            }
                        }).catch(err => console.error(`Failed to create role ${listOfHMD[hmdNameIndex]}`, err));

                        role = message.guild.roles.cache.filter(role => role.name === listOfHMD[hmdNameIndex]).first();
                    }
                    await message.member.roles.add(role);
                } else {
                    noFoundHMD.push(args[i]);
                }
            }
            if (noFoundHMD.length > 0) {
                let string = "\n";
                for (let i = 0; i < noFoundHMD.length; i++) {
                    string = string + noFoundHMD[i] + "\n"
                }
                message.channel.send(`Could not add these HMDs to you, try using \`${client.config.prefix}hmd help\` command for help.` + string);
            }
            if (foundHMD > 0) message.channel.send(`Added ${foundHMD} roles to you.`);
    }
}
module.exports = HMD;