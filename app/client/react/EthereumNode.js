class EthereumNode {

  constructor () {
    this.web3 = null;
    this.id = '';
    this.filter = null;
  }

  initializeConnection (port) {
    let web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:' + port));
    web3._extend({
      'property': 'admin',
      'methods':  [],
      properties: [new web3._extend.Property({
        'name':   'peers',
        'getter': 'admin_peers',
      }), new web3._extend.Property({
        'name':   'nodeInfo',
        'getter': 'admin_nodeInfo',
      }), new web3._extend.Method({
        'name':   'addPeer',
        'call':   'admin_addPeer',
        'params': 1,
      })],
    });

    this.web3 = web3;

    let defer = new Promise( (resolve, reject) => {
      let nodeInfoTimer = setInterval(() => {
        this.isConnected()
        .then( ([err, connected]) => {
          if(connected) {
            clearInterval(nodeInfoTimer);
            return this.getNodeInfo();
          }

          return Promise.reject('node is not connected');
        })
        .then(([err, nodeInfo]) => {
          this.id = nodeInfo.id;
          return this.getAccounts();
        })
        .then(([err, accounts]) => {
          this.web3.eth.defaultAccount = accounts[0];
          resolve(this);
        });
      }, 1000);
    });

    this.filter = this.web3.eth.filter('pending');

    return defer;
  }

  isConnected () {
    let defer = new Promise((resolve, reject) => {
      this.web3.net.getListening( (err, listening) => {
        resolve([err, listening]);
      });
    });

    return defer;
  }

  getNodeInfo () {
    let defer = new Promise( (fufill, reject) => {
      this.web3.admin.getNodeInfo(function (err, nodeInfo) {
        fufill([err, nodeInfo]);
      });
    });

    return defer;
  }

  getAccounts () {
    let defer = new Promise( (fufill, reject) => {
      this.web3.eth.getAccounts(function (err, accounts) {
        fufill([err, accounts]);
      });
    });

    return defer;
  }

  /*Adds a peer node. If no node is given adds the bootnode*/
  addPeer (bootnode) {
    bootnode = bootnode || EthereumNetwork.getDefaultBootnode();
    let defer = new Promise( (fufill, reject) => {
      bootnode.getNodeInfo().then(([err, bootnodeInfo]) => {
        this.web3.admin.addPeer(bootnodeInfo.enode, ()=>{});
        fufill();
      });
    });

    return defer;
  }

  getPeers () {
    let defer = new Promise( (fufill, reject) => {
      this.web3.admin.getPeers( function (err, peers) {
        peers = peers.map((peer) => {
          return EthereumNetwork.getNodeByID(peer.id);
        });

        /*sometimes geth/web3 will return nodes that don't exist,
        one way to remove them is to only allow nodes EthereumNetwork
        already knows about*/
        peers = peers.filter(Boolean);

        fufill([err, peers]);
      });
    });

    return defer;
  }

  sendTransaction (txObj) {
    let defer = new Promise( (fufill, reject) => {
      this.web3.eth.sendTransaction(txObj, (err, result) => {
        fufill([err, result]);
      });
    });

    return defer;
  }

  filter () {

  }
}

window.EthereumNode = EthereumNode;
export {EthereumNode};