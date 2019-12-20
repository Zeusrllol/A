var http = require('http');
var droidapikey = process.env.DROID_API_KEY;
var config  = require('../config.json');

function isEligible(member) {
    var res = 0;
    var eligibleRoleList = config.mute_perm; //mute_permission but used for this command, practically the same
    eligibleRoleList.forEach((id) => {
        if(member.roles.has(id[0])) res = id[1]
    });
    return res
}

function danid (hash) {
    switch (hash) {
        case "53d46ac17cc3cf56f35c923f72343fa5": return 1; // 1st Dan
        case "520e21c012c50b328cec7dff20d6ba37": return 2; // 2nd Dan
        case "78ce191ff0e732fb7a3c76b5b1b68180": return 3; // 3rd Dan
        case "461f0c615a5cba0d33137ce28dd815fb": return 4; // 4th Dan
        case "f3577717c5a3ecbe7663a9b562453ea3": return 5; // 5th Dan
        case "056bf9d0d67b0b862d831cfe65f09ae7": return 6; // 6th Dan
        case "26beb83acc2133f3b756288d158fded4": return 7; // 7th Dan
        case "47d5130e26c70c7ab8f4fc08424f4459": return 8; // 8th Dan
        case "5c10b8deba7725ba1009275f1240f950": return 9; // 9th Dan
        case "40261e470a4649e3f77b65d64964529e": return 10; // Chuuden
        case "c12aa4ce57bf072ffa47b223b81534dd": return 11; // Kaiden
        case "b07292999f84789970bf8fbad72d5680": return 12; // Aleph-0 Dan
        default: return 0
    }
}

function dancheck (dan) {
    switch (dan) {
        case 1: return "1st Dan";
        case 2: return "2nd Dan";
        case 3: return "3rd Dan";
        case 4: return "4th Dan";
        case 5: return "5th Dan";
        case 6: return "6th Dan";
        case 7: return "7th Dan";
        case 8: return "8th Dan";
        case 9: return "9th Dan";
        case 10: return "Chuuden";
        case 11: return "Kaiden";
        case 12: return "Aleph-0 Dan";
        default: return false
    }
}

function validation (dan, mod, acc, rank) {
    var res;
    if (mod.includes("n") || mod.includes("e") || mod.includes("t")) {
        res = 0;
        return res
    }
    if (dan >= 1 && dan <= 9) { // 1st-9th Dan
        if (acc >= 97) res = 1;
        else {
            if (rank.includes("S")) res = 1;
            else res = 0;
        }
    }
    if (dan === 10) { // Chuuden
        if (acc >= 93) res = 1;
        else res = 0
    }
    if (dan === 11) { // Kaiden
        if (acc >= 90) res = 1;
        else res = 0
    }
    if (dan === 12) { // Aleph-0 Dan
        if (rank.includes("A")) res = 1;
        else res = 0
    }
    return res
}

module.exports.run = (client, message, args, maindb) => {
    if (message.channel.id != '361785436982476800') return message.channel.send("❎ **| I'm sorry, this command is only supported in dan course channel in osu!droid International Discord server.**");
    let danlist = ["1st Dan", "2nd Dan", "3rd Dan", "4th Dan", "5th Dan", "6th Dan", "7th Dan", "8th Dan", "9th Dan", "Chuuden", "Kaiden", "Aleph-0 Dan"];
    if (args[0]) {
        let perm = isEligible(message.member);
        if (perm == 0) return message.channel.send("❎ **| I'm sorry, you don't have permission to use this. Please ask a Helper!**");

        let togive = message.guild.member(message.mentions.users.first() || message.guild.members.get(args[0]));
        if (!togive) return message.channel.send("❎ **| Hey, I don't know the user to give the role to!**");
        
        let rolename = args.slice(1).join(" ");
        if (!danlist.includes(rolename)) {
            let rolelist = '';
            danlist.forEach(role => {
                rolelist += '`' + role + '` ';
            });
            rolelist = rolelist.trimRight().split(" ").join(", ");
            return message.channel.send(`❎ **| I'm sorry, I cannot find the role! Accepted arguments are ${rolelist}.**`)
        }

        let role = message.guild.roles.find(r => r.name === rolename);
        if (!role) return message.channel.send(`❎ **| I'm sorry, I cannot find ${rolename} role!**`);
        if (togive.roles.has(role.id)) return message.channel.send(`❎ **| I'm sorry, the user already has ${rolename} role!**`);

        togive.addRole(role.id, "Successfully completed dan course").then (() => {
            message.channel.send(`✅ **| ${message.author}, successfully given ${rolename} role for <@${togive.id}>. Congratulations for <@${togive.id}>!**`)
        }).catch(e => console.log(e))
    }
    else {
        let binddb = maindb.collection("userbind");
        let query = {discordid: message.author.id};
        binddb.find(query).toArray((err, res) => {
            if (err) {
                console.log(err);
                return message.channel.send("❎ **| I'm sorry, I'm having trouble receiving response from database. Please try again!**")
            }
            if (!res[0]) return message.channel.send("❎ **| I'm sorry, your account is not binded. You need to use `a!userbind <uid>` first. To get uid, use `a!profilesearch <username>`.**");
            var uid = res[0].uid;
            var options = {
                host: "ops.dgsrz.com",
                port: 80,
                path: "/api/getuserinfo.php?apiKey=" + droidapikey + "&uid=" + uid
            };
            var content = '';
            var req = http.request(options, res1 => {
                res1.setEncoding("utf8");
                res1.on("data", chunk => {
                    content += chunk
                });
                res1.on("error", err1 => {
                    console.log(err1);
                    return message.channel.send("❎ **| I'm sorry, I'm having trouble receiving response from osu!droid API. Please try again!**")
                });
                res1.on("end", () => {
                    let resarr = content.split("<br>");
                    let headerres = resarr[0].split(" ");
                    if (headerres[0] == 'FAILED') return message.channel.send("❎ **| I'm sorry, I cannot find your username!**");
                    var obj;
                    try {
                        obj = JSON.parse(resarr[1])
                    } catch (e) {
                        return message.channel.send("❎ **| I'm sorry, I'm having trouble receiving response from osu!droid API. Please try again!**")
                    }
                    if (!obj.recent[0]) return message.channel.send("❎ **| You haven't set any plays!**");
                    let play = obj.recent[0];
                    let mods = play.mode;
                    let acc = (parseInt(play.accuracy) / 1000).toFixed(2);
                    let rank = play.mark;
                    let hash = play.hash;

                    let dan = danid(hash);
                    if (dan === 0) return message.channel.send("❎ **| I'm sorry, you haven't played any dan course recently!**");

                    let valid = validation(dan, mods, acc, rank);
                    if (valid === 0) return message.channel.send("❎ **| I'm sorry, the dan course you've played didn't fulfill the requirement for dan role!**");

                    let danrole = dancheck(dan);
                    if (!danrole) return message.channel.send("❎ **| I'm sorry, I cannot find the dan role!**");

                    let role = message.guild.roles.find(r => r.name === danrole);
                    if (!role) return message.channel.send(`❎ **| I'm sorry, I cannot find ${danrole} role!**`);
                    if (message.member.roles.has(role.id)) return message.channel.send(`❎ **| I'm sorry, you already have ${danrole} role!**`);
                    message.member.addRole(role.id, "Successfully completed dan course").then(() => {
                        message.channel.send(`✅ **| ${message.author}, congratulations! You have completed ${danrole}.**`)
                    }).catch(e => console.log(e));
                })
            });
            req.end()
        })
    }
    // Dan Course Master
    danlist.pop();
    let count = 1;
    danlist.forEach(role => {
        if (message.member.roles.find(r => r.name === role)) count++
    });
    if (count == danlist.length) {
        let dcmrole = message.guild.roles.find(r => r.name === "Dan Course Master");
        if (!dcmrole) return message.channel.send("❎ **| I'm sorry, I cannot find the Dan Course Master role!**");
        message.member.addRole(dcmrole.id, "Successfully completed required dan courses").then(() => {
            message.channel.send(`✅ **| ${message.author}, congratulations! You have completed every dan required to get the Dan Course Master role!**`)
        }).catch(e => console.log(e))
    }
};

module.exports.help = {
    name: "dancourse"
};
