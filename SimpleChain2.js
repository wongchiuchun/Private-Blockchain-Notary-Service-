//implement all library functions
const level = require('level');
const chainDB = './blockchaindata';
const db = level(chainDB);
const Boom = require('boom');
const bitcoin = require('bitcoinjs-lib');
const bitcoinMessage = require('bitcoinjs-message');
const SHA256 = require('crypto-js/sha256');


//list of live requests
let validationList = [];
//list of confirmed requests
let validatedList = [];


// Add data to levelDB with key/value pair
function addLevelDBData(key,value){
  return new Promise(function (resolve, reject){
    db.put(key, value, function(err) {
    if (err) {
      return console.log('Block ' + key + ' submission failed', err);
      reject(err);
    }else{
      resolve(value);
    }
  });
});
}

// Get data from levelDB with key
function getLevelDBData(key){
  return new Promise(function (resolve, reject){
  db.get(key, function(err, value) {
    if (err){
      return console.log('Not found!', err);
      reject(err);
    }else{
      resolve(value);
    }
  });
});
}




/* ===== Block Class ==============================
|  Class with a constructor for block 			   |
|  ===============================================*/

class Block{
	constructor(address,ra,dec,story,mag,con){
     this.hash = "",
     this.height = 0,
     this.body = new Body (address,ra,dec,story,mag,con),
     this.time = 0,
     this.previousBlockHash = ""
    }
}

//reconstruct the class to include the star object
class Body{
  constructor(address,ra,dec,story,mag,con){
    this.address = address,
    this.star = JSON.parse(JSON.stringify(new Star(ra,dec,story,mag,con)))
  }

}

class Star{
  constructor(ra,dec,story,mag = undefined, con = undefined){  //anything undefined will not shown when JSON.stringify, parse again to give that property
    this.ra = ra,
    this.dec = dec,
    this.mag = mag,
    this.con = con,
    this.story = new Buffer.from(story, 'utf8').toString('hex')
  }
}

// Create Genesis Block

let gblock = new Block("Genesis block","Nill","Nill","This is the Genesis block");

/* ===== Response Object Class ==============================
|  Class with a constructor for response 			   |
|  ===============================================*/

//response object
class requestResponse{
	constructor(address){
     this.address = address,
     this.requestTimeStamp = new Date().getTime().toString().slice(0,-3),
     this.message = this.address+":"+this.requestTimeStamp+":starRegistry",
     this.validationWindow = 300 //time in seconds to match the one with time stamp
    }
}

//status object within the response object
class statusObj{
  constructor(address){
    this.address = address,
    this.requestTimeStamp = "",
    this.message = "",
    this.validationWindow = "",
    this.messageSignature = "valid"
  }

}


//response object for validated address
class validRes{
	constructor(address){
     this.registerStar = true,
     this.status = new statusObj(address)
    }
  }



/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

//this is now also the controller
class Blockchain{

  constructor(server){
    this.server = server;
    this.createGenesisBlock();
    this.getBlockByIndex();
    this.getBlockByAddress();
    this.getBlockByHash();
    this.postNewBlock();
    this.userRequest();
    this.validateSig();
    }


    /**
     * Implement a GET Endpoint to retrieve a block by index, url: "/block/{index}"
     */
  getBlockByIndex() {
        this.server.route({
            method: 'GET',
            path: '/block/{index}',
            handler: async (request, h) => {
              //check to see if index is in range or valid. If not throw an error message
                  if (! (await this.getBlockHeight() > request.params.index && request.params.index >= 0)){
                    throw Boom.badRequest("Index error! Block index not in the block range. Please enter a valid Block Index and try again")
                  }
                  else{
                    //call the get block function using the request index
                    let result = JSON.parse(await this.getBlock(request.params.index));
                    //add decoded story
                    result.body.star["storyDecoded"] = (new Buffer(result.body.star.story, 'hex')).toString();
                    return result
                  }
            }
        });
    }



    /**
     * Implement a GET Endpoint to retrieve a block by address, url: "/stars/address:{address}"
     */
  getBlockByAddress() {
        this.server.route({
            method: 'GET',
            path: '/stars/address:{address}',
            handler: async (request, h) => {
                    //get the blocks by address
                    let result = await this.getBlockAdd(request.params.address);
                    //check if the list is empty
                    if (JSON.stringify(result) != "[]"){
                      //loop through the list to added the decoded story property
                      for (let i = 0; i< result.length; i++){
                        result[i].body.star["storyDecoded"] = (new Buffer(result[i].body.star.story, 'hex')).toString();
                      }
                      return result
                    }else{
                      throw Boom.badRequest("No star found under this address")
                    }

                  }
        });
    }

    /**
     * Implement a GET Endpoint to retrieve a block by hash, url: '/stars/hash:{hash}'
     */
  getBlockByHash() {
        this.server.route({
            method: 'GET',
            path: '/stars/hash:{hash}',
            handler: async (request, h) => {
                    //get block by hash value
                    let result = await this.getBlockHash(request.params.hash);
                    if (result){
                      //add decoded story property
                      result.body.star["storyDecoded"] = (new Buffer(result.body.star.story, 'hex')).toString();
                      return result}
                    else{
                      throw Boom.badRequest("No star found under this hash value")
                    }
            }
        });
    }





    /**
     * Implement a POST Endpoint to add a new Block, url: "/api/block"
     */
     //tested error handling - boom has already picked up any empty value as bad request 400
  postNewBlock() {
        //let self = this;
        this.server.route({
            method: 'POST',
            path: '/block',
            handler: async (request, h) => {
              //check if there is any input data for block and add block only if there is
              if (request.payload.address && request.payload.star.ra && request.payload.star.dec && request.payload.star.story){
                //set blockindex variable
                let blockIndex;
                //check if the address has been validated
                for (let i=0; i<validatedList.length; i++) {if (validatedList[i].status.address===request.payload.address){
                  //get the position of the address on the list
                  blockIndex = i;
                  //create new block
                  await this.addBlock(new Block(request.payload.address, request.payload.star.ra, request.payload.star.dec, request.payload.star.story, request.payload.star.mag,request.payload.star.con));
                  //get block height first
                  let unadjheight = await this.getBlockHeight();
                  //adjust the height
                  let index = unadjheight - 1;
                  //remove the address from the Validated list
                  validatedList.splice(blockIndex,1);
                  //return the latest block info
                  return JSON.parse(await this.getBlock(index));
                 }else {
                   throw Boom.badRequest("Address has not been validated")
                 }

              }

              }else{
                throw Boom.badRequest("Please input data for star registration")
              }
            }
      });
    }

    /**
     * Implement a POST Endpoint to request access
     */
     //tested error handling - boom has already picked up any empty value as bad request 400

    userRequest() {
          this.server.route({
              method: 'POST',
              path: '/requestValidation',
              handler: async (request, h) => {
                // if there is an input for address
                if (request.payload.address && validationList.length === 0){
                    //create a request object
                    let newRequest = await new requestResponse(request.payload.address);
                    //added address and timestamp of object to the list
                    validationList.push(newRequest);
                    //get address index
                    let index = validationList.findIndex(x => x.address === newRequest.address);
                    //use setTimeout function to remove the address from the list at timeout. Start the countdown
                    setTimeout(function() {validationList.splice(index,1)}, 300000);
                    //return the object
                    return await newRequest;//}

                }else if (request.payload.address && validationList.length > 0) {
                  //check if the list contains the address already
                    let index;
                    let result;
                    for (let i=0; i<validationList.length; i++) {
                      if (validationList[i].address===request.payload.address){index = i}else{result = false}};
                    //if not
                    if(result === false){
                      //create a request object
                      let newRequest = await new requestResponse(request.payload.address);
                      //added address and timestamp of object to the list
                      validationList.push(newRequest);
                      //get address index
                      let index = validationList.findIndex(x => x.address === newRequest.address);
                      //use setTimeout function to remove the address from the list at timeout. Start the countdown
                      setTimeout(function() {validationList.splice(index,1)}, 300000);
                      //return the object
                      return await newRequest;
                    }else{
                      //get current remaining time
                      let time = new Date().getTime().toString().slice(0,-3);
                      //get request time
                      let oldTime = await validationList[index].requestTimeStamp;
                      //get time lapsed
                      let timeLapsed = parseInt(time) - parseInt(oldTime);
                      //remaining time
                      let timeRemaining = 300 - timeLapsed;
                      //update validationWindow time
                      validationList[index].validationWindow = timeRemaining
                      return validationList[index];
                    }
              }else{
                throw Boom.badRequest("Please input address to start the validation")
              }
            }
        });
      }

      validateSig() {
              this.server.route({
                  method: 'POST',
                  path: '/message-signature/validate',
                  handler: async (request, h) => {
                    //check if the user has put in the relevant data
                    if (request.payload.address && request.payload.signature){
                      //check if address is still on the list
                      for (let i=0; i<validationList.length; i++) {if (validationList[i].address===request.payload.address){
                        //get address for validation
                        let address = request.payload.address;
                        //get signature for validation
                        let signature = request.payload.signature;
                        //get index of this item in the validtion list
                        let index = await validationList.findIndex(x => x.address === address);
                        //get message for validatio
                        let message = await validationList[index].message;
                        //get current remaining time
                        let time = new Date().getTime().toString().slice(0,-3);
                        //get request time
                        let oldTime = await validationList[index].requestTimeStamp;
                        //get time lapsed
                        let timeLapsed = parseInt(time) - parseInt(oldTime);
                        //remaining time
                        let timeRemaining = await validationList[index].validationWindow - timeLapsed;
                        //validate the signature
                        let validity = bitcoinMessage.verify(message, address, signature);
                        //check if valid
                        if (validity){
                            //create response object
                            let newValid = await new validRes(address);
                            newValid.status.requestTimeStamp = oldTime;
                            newValid.status.message = message;
                            newValid.status.validationWindow = timeRemaining; //payload.timeout method or a countdown function
                            //add the object to the validated validatedList
                            validatedList.push(newValid);
                            //return the object
                            return newValid;
                        }
                        else{
                          throw Boom.badRequest("Validation Failed. Please try again with the correct address and signature.");
                        }

                      }
                    else{
                      throw Boom.badRequest("The address provided is not on the request list. Please restart the process");
                    }
                  }
                }else{
                    throw Boom.badRequest("Please input the address and signature");
                  }
                }
            });
          }


  async createGenesisBlock(){
    let height = await this.getBlockHeight();

    if (height === 0) {
    //change genesis block time
    gblock.time = new Date().getTime().toString().slice(0,-3);
    //work out genesis block hash
    gblock.hash = SHA256(JSON.stringify(gblock)).toString();
    // wait for the genesis block to be added
    await addLevelDBData(0, JSON.stringify(gblock).toString());
    // confirm genesis block has been added
    console.log("genesis block has been created")
  };
}



  // Add new block
  async addBlock(newBlock){
    // check if there is already a genesis block
      let height = await this.getBlockHeight();

      if (height === 0) {
      //change genesis block time
      gblock.time = new Date().getTime().toString().slice(0,-3);
      //work out genesis block hash
      gblock.hash = SHA256(JSON.stringify(gblock)).toString();
      // wait for the genesis block to be added
      await addLevelDBData(0, JSON.stringify(gblock).toString());
      // confirm genesis block has been added
      console.log("genesis block has been created")
    }else{

      newBlock.height = height;
    // UTC timestamp
      newBlock.time = new Date().getTime().toString().slice(0,-3);
    // get previous block data in the form of an object
      let phash = await getLevelDBData(newBlock.height-1);
    // parse that object and get the hash data then assign it to previous hash
      newBlock.previousBlockHash = JSON.parse(phash).hash;

    // Block hash with SHA256 using newBlock and converting to a string
      newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
    // wait for the block to be added to chain
      await addLevelDBData(newBlock.height, JSON.stringify(newBlock).toString());
    // print confirmation that it has been added
      console.log(`Block ${newBlock.body} has been added to the chain`);
};
  }



  // Get block height
  getBlockHeight() {
    return new Promise(function(resolve, reject){
      let i = 0;
      db.createReadStream().on('data', function(data) {
            i++;
          }).on('error', function(err) {
              return console.log('Unable to read data stream!', err);
              reject(err)
          }).on('close', function() {
              resolve(i)
          });
    });
    }

    //Get block by address
    getBlockAdd(address) {
          return new Promise(function(resolve, reject){
            let list = []
            db.createValueStream().on('data', function(data) {
                  if (JSON.parse(data).body.address === address){
                    list.push(JSON.parse(data));}
                }).on('error', function(err) {
                    return console.log('Unable to read data stream!', err);
                    reject(err)
                }).on('close', function() {
                    resolve(list)
                });
          });
          }

      //Get block by hash
      getBlockHash(hash) {
                return new Promise(function(resolve, reject){
                  let item;
                  db.createValueStream().on('data', function(data) {
                        if (JSON.parse(data).hash === hash){
                          item = JSON.parse(data);}
                      }).on('error', function(err) {
                          return console.log('Unable to read data stream!', err);
                          reject(err)
                      }).on('close', function() {
                          resolve(item)
                      });
                });
                }

    // get block
  getBlock(blockHeight){
      // return object as a single string
      return getLevelDBData(blockHeight);
    }

    // validate block
  async validateBlock(blockHeight){
      // get block object
      let rawBlock = await this.getBlock(blockHeight).then((result)=>{return result});
      // get block hash
      let block = JSON.parse(rawBlock);

      let blockHash = block.hash;
      // remove block hash to test block integrity
      block.hash = '';
      // generate block hash
      let validBlockHash = SHA256(JSON.stringify(block)).toString();
      // Compare
      if (blockHash===validBlockHash) {
          return true;
        } else {
          console.log('Block #'+blockHeight+' invalid hash:\n'+blockHash+'<>'+validBlockHash);
          return false;
        }
    }

    // Validate blockchain
    validateChain(){
      let errorLog = [];
      let self = this;
      db.createKeyStream().on('data', async function(data) {
          //get block height
          let height = await self.getBlockHeight();
          // get result from validate block, validate each block
          let fresult = await self.validateBlock(data).then((result)=>{return result});
          // if result is false, add the blockheight to errlog
          if (fresult === false){
            errorLog.push(data);
          }
          //check if data has a next block, prepare to validate the chain
          if (data<height-1){
              //get current block info
              let rawBlock = await self.getBlock(data).then((result)=>{return result});
              // parse it
              let block = JSON.parse(rawBlock);
              //get its hash
              let blockHash = block.hash;
              //get next block info
              let nextRawBlock = await self.getBlock(parseInt(data)+1).then((result)=>{return result})
              // parse it
              let nextblock = JSON.parse(nextRawBlock);
              //get next block previous hash
              let previousHash = nextblock.previousBlockHash;
              //compare the hash of current block with previousHash of next block, if doesn't match, add to errlog
              if (blockHash!==previousHash) {
                errorLog.push(data);
              };
            }
          }).on('error', function(err) {
              return console.log('Unable to read data stream!', err)
          //once all done, check if there is any error in the errorLog
          }).on('close', function() {
              return errorLog;
          });
        if (errorLog.length>0) {
          console.log('Block errors = ' + errorLog.length);
          console.log('Blocks: '+errorLog);
        } else {
          console.log('No errors detected');
        };
      }

}

/**
 * Exporting the BlockController class
 * @param {*} server
 */
module.exports = (server) => { return new Blockchain(server);}
