const {User,Listing,Bid} = require('./model.js');
const Service = require('soa-demo-service-amqp');
const authToken = require('soa-demo-token');

var bidIncLevels = [
    { lt:500,   inc:10  },
    { lt:2000,  inc:20  },
    { lt:10000, inc:50  },
    {           inc:100 }
];
var amountPlusBidInc = amount => amount + bidIncLevels.find( lvl => ! lvl.lt || amount < lvl.lt ).inc;

const service = new Service('bid');

service.add('cmd:add', async ({token, listingId, amount}) => {
	const user = authToken.verify(token);
	if (! user) return {error:"Invalid Token."};

	// TODO - start DB transaction and/or obtain transaction lock ...
	const [prevBid, listing] = await Promise.all([getPrevBid(listingId), Listing.findOne({where:{listingId}})]);
	if (! listing) return {error:"Invalid Listing."};
	const minBid = prevBid ? amountPlusBidInc(prevBid.amount) : listing.amount;
	if (amount < minBid) return {error:`You must bid at least ${minBid}.`};
	
	const newBid = {userId:user.userId, listingId, amount:minBid, maxAmount:amount};
	const bids = [prevBid, newBid];
	bids.push(proxyBid(bids));   
	bids.push(proxyBid(bids));
	if (bids[2] && ! bids[3]) newBid.amount = newBid.maxAmount;
	
	const newBids = bids.slice(1).filter(bid => bid);
	for (let bid of newBids) await Bid.create(bid);
	
	const winningBid = newBids.slice(-1)[0];
	const nextBidAmount = amountPlusBidInc(winningBid.amount);
	service.publish("addBid", {winningBidderId:winningBid.userId, listingId, currentBidAmount:winningBid.amount, nextBidAmount, numberOfBids:newBids.length});
	
	var trueBids = bids.filter(bid => bid);
	var outbid = trueBids.length > 1 && trueBids.slice(-2)[0];
	if (outbid) service.publish("outbid", {userId:outbid.userId, listingId, nextBidAmount});

	delete winningBid.maxAmount;
	return {winningBid};
});

function getPrevBid(listingId) {
	return Bid.findOne({where:{listingId},order:[['bidId','DESC']]});
}

function proxyBid (bids) {
	const [prevBid, newBid] = bids.slice(-2);
	if (! prevBid || ! newBid) return;
	if (prevBid.maxAmount < newBid.amount) return;
	if (prevBid.maxAmount == newBid.amount && ! prevBid.bidId) return;
	const amount = Math.min(prevBid.maxAmount, amountPlusBidInc(newBid.maxAmount));
	return {userId:prevBid.userId, listingId:prevBid.listingId, amount, maxAmount:prevBid.maxAmount};
}

service.add('cmd:list', ({listingId}) => {
	return Bid.findAll({
		where:{listingId}, 
		order:[['bidId','DESC']], 
		attributes:['amount','createdAt'], 
		include:[{model:User, attributes:['username']}]
	});
});

service.add('event:addUser', ({userId, username}) => User.create({userId, username}));
service.add('event:addListing', ({listingId, sellerId, amount}) => Listing.create({listingId, sellerId, amount}));

// TODO - create separate microservice to send email to buyer in response to outbid events.
// For now, just log the outbid event message.
service.add('event:outbid', ({userId, listingId, nextBidAmount}) => 
	console.log(`User ${userId} outbid on listing ${listingId}; new minimum bid is ${nextBidAmount}`));

module.exports = service;
