const Sequelize = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL);

var User = sequelize.define('user', {
	userId: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true },
	username: { type: Sequelize.STRING, allowNull: false, unique: true },
});

var Listing = sequelize.define('listing', 
	{
		listingId: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true },
		sellerId: { type: Sequelize.STRING, allowNull: false },
		amount: { type: Sequelize.INTEGER, allowNull: false },
	},{
		indexes: [
			{ fields: ['sellerId'] },
		]
	}
);

var Bid = sequelize.define('bid',
	{
		bidId: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
		listingId: { type: Sequelize.INTEGER, allowNull: false },
		userId: { type: Sequelize.INTEGER, allowNull: false },
		amount: { type: Sequelize.INTEGER, allowNull: false },
		maxAmount: { type: Sequelize.INTEGER, allowNull: false },
	},{
		indexes: [
			{ fields: ['listingId'] },
		]
	}
);

setTimeout( () => Bid.belongsTo(User,{foreignKey:'userId'}), 100);

if (process.argv[2] == '--sync') {
	User.sync({force: true});
	Listing.sync({force: true});
	Bid.sync({force: true});
}

exports.User = User;
exports.Listing = Listing;
exports.Bid = Bid;
