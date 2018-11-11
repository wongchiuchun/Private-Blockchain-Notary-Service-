## Introduction
This project is a decentralised star notary platform using the blockchain technology. User could send a request the to the platform for star registration. Once you have verified your bitcoin address, you will be able to access the platform and register a star with its story. You could also retrieve star data from the platform using your bitcoin address, the hash value of the star stored or the block height.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Installing Node and NPM is pretty straightforward using the installer package available from the (Node.js® web site)[https://nodejs.org/en/].

### Configuring your project

- Install all project dependencies using the package.json file
```
npm install
```

## Node.js framework

This project uses the Hapi.js framework. You can get more information about the framework here https://hapijs.com/

## API Endpoints

1: getBlockByIndex()
   URL: '/block/{index}'
   Method: 'GET'
   URL Params: index = [integer] (e.g.'/block/0')
   Note: Index should be within the range of available data, else an error message will return

2: getBlockByAddress()
   URL: '/stars/address:{address}'
   Method: 'GET',
   URL Params: address = [valid bitcoin address]
   Note: It will return the stars registered under this address.

3: getBlockByHash()
   URL: '/stars/hash:{hash}'
   Method: 'GET',
   URL Params: hash = [valid hash value of a block]

4: userRequest()
   URL:'/requestValidation'
   Method: 'POST',
   Data Params: {address: [valid bitcoin address]}
   Note: You should enter a bitcoin address that you own to initiate the request. Once submitted you have 60s to verify this address by providing a valid signature to the validateSig() API Endpoint using the message returned to you

5: validateSig()
   URL: '/message-signature/validate'
   Method: 'POST',
   Data Params: {address: [same address you submitted the request], signature: [signature generated based on the message provided]}
   Note: Once validated the user could use the verified address to register a star


6: postNewBlock()
   URL: '/block'
   Method: 'POST'
   Data Params: {address: [validated address], ra: [right ascension], dec: [declination], story: [text], mag: [optional: magnitude], con: [optional: constellation]}
   Note: You should enter the required data in the payload to create a new block



## Testing of Blockchain and Database Code

To test code:
1: Open a command prompt or shell terminal after install node.js.
2: Enter a node session, also known as REPL (Read-Evaluate-Print-Loop).
```
node
```
3: Copy and paste your code into your node session
4: Instantiate blockchain with blockchain variable
```
let blockchain = new Blockchain();
```
5: Generate 10 blocks using a for loop
```
for (var i = 0; i <= 10; i++) {
  blockchain.addBlock(new Block("test data "+i));
}
```
6: Validate blockchain
```
blockchain.validateChain();
```
7: Induce errors by changing block data
```
let inducedErrorBlocks = [2,4,7];
for (var i = 0; i < inducedErrorBlocks.length; i++) {
  blockchain.chain[inducedErrorBlocks[i]].data='induced chain error';
}
```
8: Validate blockchain. The chain should now fail with blocks 2,4, and 7.
```
blockchain.validateChain();
```
## Testing of the server

To test server:
1: Open a command prompt and run the server.js file in node environment:
```
node server.js
```
2: Wait until you see "Server running at: http://localhost:8000"

3: Open your browser at http://localhost:8000 to test the API Endpoints
