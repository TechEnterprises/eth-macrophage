import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
let _NetworkMemberIDs = new Mongo.Collection('networkMemberIDs');
Meteor.publish('networkMemberIDs', () => {
  return _NetworkMemberIDs.find({});
});
_NetworkMemberIDs.allow({
  insert: function (userId, doc) {
    return true;
  },
  update: function (userId, doc, fields, modifier) {
    return true;
  },
  remove: function (userId, doc) {
    return true;
  },
});


const spawn = Npm.require('child_process').spawn;
const exec = Npm.require('child_process').exec;

var tailStream = require('tail-stream');

const GETH_BASE_PORT = 21000;
const GETH_BASE_RPCPORT = 22000;
const GETH_BASE_DATADIR = '/tmp/eth-macrophage/';

let curNonceState = 0;

exec('mkdir ' + GETH_BASE_DATADIR);

//base configuration for a geth instance
var gethConfig = {
  datadir:       GETH_BASE_DATADIR,
  logfile:       'log.log',
  port:          GETH_BASE_PORT,
  rpc:           true,
  rpcport:       GETH_BASE_RPCPORT,
  rpcaddr:       '127.0.0.1',
  rpcapi:        'admin,web3,eth,net',
  networkid:     35742222,
  rpccorsdomain: 'http://127.0.0.1:3000, http://localhost:3000',
  minerthreads:  1,
  genesis:       Assets.absoluteFilePath('genesis.json'),
  password:      Assets.absoluteFilePath('password'),
  bootnodes:     '""',
};

function createGethInstance () {
  let curNonce = curNonceState;
  //need an instance so the callback below will use this version and not changes
  let gethInstanceConfig = {};
  for(let attr in gethConfig) {
    if(gethConfig.hasOwnProperty(attr)) gethInstanceConfig[attr] = gethConfig[attr];
  }

  gethInstanceConfig.port = GETH_BASE_PORT + curNonce;
  gethInstanceConfig.rpcport = GETH_BASE_RPCPORT + curNonce;
  gethInstanceConfig.datadir = GETH_BASE_DATADIR + 'node' + curNonce;
  gethInstanceConfig.logfile = gethInstanceConfig.datadir + '/output.log';
  let LogData = new Mongo.Collection('logdata' + curNonce);
  LogData.remove({});
  Meteor.publish('logdata' + curNonce, () => {
    return LogData.find({});
  });

  exec('mkdir ' + gethInstanceConfig.datadir);
  exec('touch ' + gethInstanceConfig.logfile, Meteor.bindEnvironment(() => {
    let logStream = tailStream.createReadStream(gethInstanceConfig.logfile, {});
    logStream.on('data', Meteor.bindEnvironment( (data) => {
      let messages = /\{.*\}/.exec(data);
      if(!!messages && messages.length == 1) {
        let message = JSON.parse(messages[0]);
        LogData.insert(message);
      }
    }));
  }));

  exec('geth --datadir=' + gethInstanceConfig.datadir + ' --password=' +
  gethInstanceConfig.password + ' account new', function () {
    exec('geth --datadir=' + gethInstanceConfig.datadir +
    ' init ' + gethInstanceConfig.genesis, () => {

      let cmd = spawn('geth', ['--datadir=' + gethInstanceConfig.datadir, '--logfile=' +
      gethInstanceConfig.logfile, '--port=' + gethInstanceConfig.port, '--rpc', '--rpcport=' +
      gethInstanceConfig.rpcport, '--rpcaddr=' + gethInstanceConfig.rpcaddr, '--rpcapi=' +
      gethInstanceConfig.rpcapi, '--networkid=' + gethInstanceConfig.networkid,
      '--rpccorsdomain=' + gethInstanceConfig.rpccorsdomain, '--unlock=0',
      '--password=' + gethInstanceConfig.password, '--bootnodes=' + gethInstanceConfig.bootnodes,
      'js', Assets.absoluteFilePath('mine.js')]);

      //For some reason geth flips the out and err output..or something
      cmd.stdout.on('data', (data) => {
        //console.log(data.toString());
      });
      cmd.stderr.on('data', (err) => {
        console.error(err.toString());
      });
    });
  });

  curNonceState++;
}

Meteor.methods({
  createGethInstance ({nonce}) {
    if(nonce >= curNonceState) {
      createGethInstance();
      return GETH_BASE_RPCPORT + (curNonceState - 1);
    }
    return GETH_BASE_RPCPORT + nonce;
  },
});