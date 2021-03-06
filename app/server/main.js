import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

const spawn = Npm.require('child_process').spawn;
const exec = Npm.require('child_process').exec;

const tailStream = require('tail-stream');

const GETH_BASE_PORT = 21000;
const GETH_BASE_RPCPORT = 22000;
const GETH_BASE_DATADIR = '/tmp/eth-macrophage/';

const MAX_GETH_INSTANCES = 4;

//have to publish this so the client can use it
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

//tracks how many instances have been created so far
let curNonceState = 0;

exec('mkdir ' + GETH_BASE_DATADIR);

//base configuration for a geth instance
var gethConfig = {
  bootnodes:     '""',
  datadir:       GETH_BASE_DATADIR,
  dev:           1,
  genesis:       Assets.absoluteFilePath('genesis.json'),
  js:            Assets.absoluteFilePath('periodicmine.js'),
  logfile:       'log.log',
  minerthreads:  1,
  maxpeers:      8,
  networkid:     35742222,
  password:      Assets.absoluteFilePath('password'),
  port:          GETH_BASE_PORT,
  rpc:           true,
  rpcport:       GETH_BASE_RPCPORT,
  rpcaddr:       '0.0.0.0',
  rpcapi:        'admin,web3,eth,net',
  rpccorsdomain: 'http://127.0.0.1:3000, http://localhost:3000, http://40.77.56.231:3000',
};

/**
* creates a new geth node and increments the curNonceState
* @return undefined
*/
function createGethInstance (isMiner) {
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
  gethInstanceConfig.js = isMiner ?
  Assets.absoluteFilePath('pendmine.js') : Assets.absoluteFilePath('periodicmine.js');

  //this database is used on the client to get this node's received txs
  let TxData = new Mongo.Collection('txdata' + curNonce);
  TxData.remove({});
  Meteor.publish('txdata' + curNonce, () => {
    return TxData.find({});
  });

  exec('mkdir ' + gethInstanceConfig.datadir);

  //TODO: turn this callback into a promise
  exec('touch ' + gethInstanceConfig.logfile, Meteor.bindEnvironment(() => {
    let logStream = tailStream.createReadStream(gethInstanceConfig.logfile, {});
    logStream.on('data', Meteor.bindEnvironment( (data) => {
      let messages = /\{.*\}/.exec(data);
      if(!!messages && messages.length == 1) {
        let message = JSON.parse(messages[0]);
        if(message.txHash) {
          TxData.insert(message);
        }
      }
    }));
  }));

  exec('geth --datadir=' + gethInstanceConfig.datadir + ' --password=' +
  gethInstanceConfig.password + ' account new', function () {
    exec('geth --datadir=' + gethInstanceConfig.datadir +
    ' init ' + gethInstanceConfig.genesis, () => {

      let cmd = spawn('geth', ['--datadir=' + gethInstanceConfig.datadir, '--dev', '--logfile=' +
      gethInstanceConfig.logfile, '--port=' + gethInstanceConfig.port, '--rpc', '--rpcport=' +
      gethInstanceConfig.rpcport, '--rpcaddr=' + gethInstanceConfig.rpcaddr, '--rpcapi=' +
      gethInstanceConfig.rpcapi, '--networkid=' + gethInstanceConfig.networkid,
      '--rpccorsdomain=' + gethInstanceConfig.rpccorsdomain, '--unlock=0',
      '--password=' + gethInstanceConfig.password, '--bootnodes=' + gethInstanceConfig.bootnodes,
      '--maxpeers=' + gethInstanceConfig.maxpeers, 'js', gethInstanceConfig.js]);

      //For some reason geth flips the out and err output..or something
      cmd.stdout.on('data', (data) => {
        console.log(data.toString());
      });
      cmd.stderr.on('data', (err) => {
        console.error(err.toString());
      });
    });
  });

  curNonceState++;
}

Meteor.methods({
  createGethInstance ({nonce, isMiner}) {
    if(nonce >= MAX_GETH_INSTANCES) {
      return {err: 'number of instances exceeded'};
    }

    if(nonce >= curNonceState) {
      createGethInstance(isMiner);
      return {err: null, rpcport: GETH_BASE_RPCPORT + (curNonceState - 1)};
    }
    return {err: null, rpcport: GETH_BASE_RPCPORT + nonce};
  },
});

