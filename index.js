const steem = require('steem');
const _ = require('lodash');
const http = require('http');
const https = require('https');

const utils = require('./helpers/utils');
const mongoose = require('mongoose');
const Regex = require("regex");
const config = require('./config.js');
let {options} = config;


http.globalAgent.maxSockets = Infinity;
https.globalAgent.maxSockets = Infinity;

if (process.env.STEEMJS_URL) {
  steem.api.setOptions({ url: process.env.STEEMJS_URL });
} else {
  steem.api.setOptions({ url: options.url });
}

mongoose.connect(options.db_url);

// define model =================
let sdb_votes = mongoose.model('sdb_votes', {
    _id: String,
    voter: String,
    weight: String,
    author: String,
    permlink: String,
    timestamp: Date,
  });
let sdb_transfers = mongoose.model('sdb_transfers', {
    _id: String,
    from: String,
    to: String,
    amount: String,
    memo: String,
    timestamp: Date,
  });
let sdb_follows = mongoose.model('sdb_follows', {
    _id: String,
    follower: String,
    following: String,
    blog: Boolean,
    timestamp: Date,
  });
let sdb_reblogs = mongoose.model('sdb_reblogs', {
    _id: String,
    account: String,
    author: String,
    permlink: String,
    timestamp: Date,
  });
let sdb_claim_reward_balances = mongoose.model('sdb_claim_reward_balances', {
    _id: String,
    account: String,
    reward_steem: String,
    reward_sbd: String,
    reward_vests: String,
    timestamp: Date,
  });
let sdb_comments = mongoose.model('sdb_comments', {
    _id: String,
    parent_author: String,
    parent_permlink: String,
    author: String,
    permlink: String,
    title: String,
    body: { type: String, default: ''},
    json_metadata: String,
    timestamp: Date,
    app: String
  });
let sdb_mentions = mongoose.model('sdb_mentions', {
    _id: String,
    account: String,
    post: Boolean,
    author: String,
    permlink: String,
    timestamp: Date,
  });
let sdb_comment_options = mongoose.model('sdb_comment_options', {
    _id: String,
    author: String,
    permlink: String,
    max_accepted_payout: String,
    percent_steem_dollars: String,
    allow_votes: Boolean,
    allow_curation_rewards: Boolean,
    extensions: String,
    timestamp: Date,
  });
let sdb_account_updates = mongoose.model('sdb_account_updates', {
    _id: String,
    account: String,
    posting: String,
    active: String,
    owner: String,
    memo_key: String,
    json_metadata: String,
    timestamp: Date,
  });
let sdb_producer_rewards = mongoose.model('sdb_producer_rewards', {
    _id: String,
    producer: String,
    vesting_shares: String,
    timestamp: Date,
  });
let sdb_curation_rewards = mongoose.model('sdb_curation_rewards', {
    _id: String,
    curator: String,
    reward: String,
    comment_author: String,
    comment_permlink: String,
    timestamp: Date,
  });
let sdb_author_rewards = mongoose.model('sdb_author_rewards', {
    _id: String,
    author: String,
    permlink: String,
    sbd_payout: String,
    steem_payout: String,
    vesting_payout: String,
    timestamp: Date,
  });
let sdb_delegate_vesting_shares = mongoose.model('sdb_delegate_vesting_shares', {
    _id: String,
    delegator: String,
    delegatee: String,
    vesting_shares: String,
    timestamp: Date,
  });
let sdb_comment_benefactor_rewards = mongoose.model('sdb_comment_benefactor_rewards', {
    _id: String,
    benefactor: String,
    author: String,
    permlink: String,
    reward: String,
    vest: Number,
    timestamp: Date,
  });
let sdb_transfer_to_vestings = mongoose.model('sdb_transfer_to_vestings', {
    _id: String,
    from: String,
    to: String,
    amount: String,
    timestamp: Date,
  });
let sdb_fill_orders = mongoose.model('sdb_fill_orders', {
    _id: String,
    current_owner: String,
    current_orderid: String,
    current_pays: String,
    open_owner: String,
    open_orderid: String,
    open_pays: String,
    timestamp: Date,
  });
let sdb_return_vesting_delegations = mongoose.model('sdb_return_vesting_delegations', {
    _id: String,
    account: String,
    vesting_shares: String,
    timestamp: Date,
  });
let sdb_limit_order_creates = mongoose.model('sdb_limit_order_creates', {
    _id: String,
    owner: String,
    orderid: String,
    amount_to_sell: String,
    min_to_receive: String,
    fill_or_kill: Boolean,
    expiration: Date,
    timestamp: Date,
});
let sdb_withdraw_vestings = mongoose.model('sdb_withdraw_vestings', {
    _id: String,
    account: String,
    vesting_shares: String,
    timestamp: Date,
});
let sdb_account_witness_votes = mongoose.model('sdb_account_witness_votes', {
    _id: String,
    account: String,
    witness: String,
    approve: Boolean,
    timestamp: Date,
});
let sdb_fill_vesting_withdraws = mongoose.model('sdb_fill_vesting_withdraws', {
    _id: String,
    from_account: String,
    to_account: String,
    withdrawn: String,
    deposited: String,
    timestamp: Date,
});
let sdb_states = mongoose.model('sdb_states', {
    _id: String,
    blockNumber: String,
    timestamp: Date
});
let sdb_escrow_transfers = mongoose.model('sdb_escrow_transfers', {
    _id: String,
    from: String,
    to: String,
    sbd_amount: String,
    steem_amount: String,
    escrow_id: Number,
    agent: String,
    fee: String,
    json_meta: String,
    ratification_deadline: Date,
    escrow_expiration: Date,
    timestamp: Date
});
let sdb_notify = mongoose.model('sdb_notify', {
    _id: String,
    username: String,
    type: String,
    data: {},
    timestamp: Date
});

//===================

let awaitingBlocks = [];

function getBlockNum() {
  return new Promise ((resolve, reject) => {
    sdb_states.find({}, function(err,res){
      if (err) {
        console.log(err);
        resolve(undefined);
      }
      else {
        console.log(res);
        var b = res[0].blockNumber || options.startingBlock || 0;
        resolve(b);
      }
    });
  });
}

const start = async () => {
  let started; 
  
  const lastBlockNum = await getBlockNum();
  console.log('Last Block Num', lastBlockNum);
  //876000 blocks ~ 1 month
  //2628000 blacks ~ 3 month
  utils.streamBlockNumFrom(lastBlockNum, options.delayBlocks, async (err, blockNum) => {
    awaitingBlocks.push(blockNum);

    if (!started) {
      started = true;
      await parseNextBlock();
    }
  });
};

const numDaysBetween = function(d1, d2) {
  var diff = Math.abs(d1.getTime() - d2.getTime());
  return diff / (1000 * 60 * 60 * 24 * 90);
};

function getBlockAsync(blockNum, virtual) {
  return new Promise ((resolve, reject) => {
    steem.api.getOpsInBlock(blockNum, virtual, (err, res) => {
      if (err) {
        console.log(res);
        resolve([]);
      }
      else {
        resolve(res);
      }
    });
  });
}

function onlyUnique(value, index, self) { 
  return self.indexOf(value) === index;
}
function safelyParseJSON (json) {
  var parsed

  try {
    parsed = JSON.parse(json)
  } catch (e) {
    // Oh well, but whatever...
  }

  return parsed // Could be undefined!
}


const parseNextBlock = async () => {
  if (awaitingBlocks[0]) {
    const blockNum = awaitingBlocks[0];

    /** Parse Block And Do Vote */
    const block = await getBlockAsync(blockNum, false)
    //const block = await steem.api.getBlockWithAsync({ blockNum });
    let blockTime = new Date();
    if (block.length>0) {

      let votes=[],transfers=[],follows=[],reblogs=[],rewards=[],mentions=[],
          comments=[],comment_options=[],account_updates=[],producer_rewards=[],
          curation_rewards=[],author_rewards=[],delegate_vesting_shares=[],comment_benefactor_rewards=[],
          transfer_to_vestings=[],fill_orders=[],return_vesting_delegations=[],withdraw_vestings=[],
          limit_order_creates=[],fill_vesting_withdraws=[],account_witness_votes=[],escrow_transfers=[];

      if (true) {

        for (var i = 0; i < block.length; i++) {

          let op = block[i].op;
          let salt = i;
          let indx = blockNum+'-'+block[i].trx_in_block+'-'+salt;
          let timestamp = new Date(block[i].timestamp);
          blockTime = timestamp;
          op[1].timestamp = timestamp;
          op[1].indx = indx;

          let oop = op[1];

          if (op[0]==='vote') {

            votes.push({
              _id: oop.indx,
              voter: oop.voter,
              weight: oop.weight,
              author: oop.author,
              permlink: oop.permlink,
              timestamp: oop.timestamp
            });
          }
          if (op[0]==='comment') {
            let regg = /(?:^|[^a-zA-Z0-9_＠\/!@#$%&*.])(?:(?:@|＠)(?!\/))([a-zA-Z0-9-.]{3,16})(?:\b(?!@|＠)|$)/g;
            let app = ''
            try {
              app = JSON.parse(opp.json_metadata).app
            } catch (e) {}
            if (oop.body && oop.body.indexOf('@@')===-1) {

              let lmentions = oop.body.match(regg);
              let postType = false;
              let mm = [];

              oop.parent_author === ''?postType=true:postType=false;

              if (lmentions && lmentions.length>0) {
                //console.log('mentions',mentions);
                for (var io = 0; io < lmentions.length; io++) {
                  var tm = lmentions[io].split('@')[1];
                  if (tm !== oop.author) {
                    if (isNaN(parseInt(tm))) {
                      mm.push(tm);
                    }
                  }
                }
                //console.log(mm);
                let mn = mm.filter((el, k, a) => k === a.indexOf(el));
                for (var j = 0; j < mn.length; j++) {
                  mentions.push({
                    _id: oop.indx+'-'+j,
                    author: oop.author,
                    permlink: oop.permlink,
                    post: postType,
                    account: mn[j],
                    timestamp: oop.timestamp
                  });
                }
              }
            }

            comments.push({
              _id: oop.indx,
              parent_author: oop.parent_author,
              parent_permlink: oop.parent_permlink,
              author: oop.author,
              permlink: oop.permlink,
              title: oop.title,
              body: oop.body,
              json_metadata: oop.json_metadata,
              timestamp: oop.timestamp,
              app
            });
          }
          if (op[0]==='comment_options') {
            oop.extensions = JSON.stringify(oop.extensions);
            comment_options.push({
              _id: oop.indx,
              author: oop.author,
              permlink: oop.permlink,
              max_accepted_payout: oop.max_accepted_payout,
              allow_votes: oop.allow_votes,
              allow_curation_rewards: oop.allow_curation_rewards,
              extensions: oop.extensions,
              timestamp: oop.timestamp
            });
          }
          if (op[0]==='author_reward') {
            author_rewards.push({
              _id: oop.indx,
              author: oop.author,
              permlink: oop.permlink,
              sbd_payout: oop.sbd_payout,
              steem_payout: oop.steem_payout,
              vesting_payout: oop.vesting_payout,
              timestamp: oop.timestamp
            });
          }
          if (op[0]==='delegate_vesting_shares') {
            delegate_vesting_shares.push({
              _id: oop.indx,
              delegator: oop.delegator,
              delegatee: oop.delegatee,
              vesting_shares: oop.vesting_shares,
              timestamp: oop.timestamp
            });
          }
          if (op[0]==='comment_benefactor_reward') {
            comment_benefactor_rewards.push({
              _id: oop.indx,
              benefactor: oop.benefactor,
              author: oop.author,
              permlink: oop.permlink,
              reward: oop.reward,
              vest: parseFloat(oop.reward),
              timestamp: oop.timestamp
            });
          }
          if (op[0]==='return_vesting_delegation') {
            return_vesting_delegations.push({
              _id: oop.indx,
              account: oop.account,
              vesting_shares: oop.vesting_shares,
              timestamp: oop.timestamp
            });
          }
        }//for

        if (votes.length>0) {
            sdb_votes.collection.insertMany(votes, {ordered: false}, function(err,res){
              if (err){
                console.log('votes',err);
              }
            });
        }
        if (transfers.length>0) {
          sdb_transfers.collection.insertMany(transfers, {ordered: false}, function(err,res){
            if (err){
              console.log('transfers',err);
            }
          });
        }
        if (follows.length>0) {
          sdb_follows.collection.insertMany(follows, {ordered: false}, function(err,res){
            if (err){
              console.log('follows',err);
            }
          });
        }
        if (reblogs.length>0) {
          sdb_reblogs.collection.insertMany(reblogs, {ordered: false}, function(err,res){
            if (err){
              console.log('reblogs',err);
            }
          });
        }
        if (mentions.length>0) {
          sdb_mentions.collection.insertMany(mentions, {ordered: false}, function(err,res){
            if (err){
              console.log('mentions',err);
            }
          });
        }
        if (comments.length>0) {
          sdb_comments.collection.insertMany(comments, {ordered: false}, function(err,res){
            if (err){
              console.log('comments',err);
            }
          });
        }
        if (comment_options.length>0) {
          sdb_comment_options.collection.insertMany(comment_options, {ordered: false}, function(err,res){
            if (err){
              console.log('comment_options',err);
            }
          });
        }
        if (rewards.length>0) {
          sdb_claim_reward_balances.collection.insertMany(rewards, {ordered: false}, function(err,res){
            if (err){
              console.log('rewards',err);
            }
          });
        }
        if (account_updates.length>0) {
          sdb_account_updates.collection.insertMany(account_updates, {ordered: false}, function(err,res){
            if (err){
              console.log('account_updates',err);
            }
          });
        }
        if (producer_rewards.length>0) {
          sdb_producer_rewards.collection.insertMany(producer_rewards, {ordered: false}, function(err,res){
            if (err){
              console.log('producer_rewards',err);
            }
          });
        }
        if (curation_rewards.length>0) {
          sdb_curation_rewards.collection.insertMany(curation_rewards, {ordered: false}, function(err,res){
            if (err){
              console.log('curation_rewards',err);
            }
          });
        }
        if (author_rewards.length>0) {
          sdb_author_rewards.collection.insertMany(author_rewards, {ordered: false}, function(err,res){
            if (err){
              console.log('author_rewards',err);
            }
          });
        }
        if (delegate_vesting_shares.length>0) {
          sdb_delegate_vesting_shares.collection.insertMany(delegate_vesting_shares, {ordered: false}, function(err,res){
            if (err){
              console.log('delegate_vesting_shares',err);
            }
          });
        }
        if (comment_benefactor_rewards.length>0) {
          sdb_comment_benefactor_rewards.collection.insertMany(comment_benefactor_rewards, {ordered: false}, function(err,res){
            if (err){
              console.log('comment_benefactor_rewards',err);
            }
          });
        }
        if (transfer_to_vestings.length>0) {
          sdb_transfer_to_vestings.collection.insertMany(transfer_to_vestings, {ordered: false}, function(err,res){
            if (err){
              console.log('transfer_to_vestings',err);
            }
          });
        }
        if (fill_orders.length>0) {
          sdb_fill_orders.collection.insertMany(fill_orders, {ordered: false}, function(err,res){
            if (err){
              console.log('fill_orders',err);
            }
          });
        }
        if (return_vesting_delegations.length>0) {
          sdb_return_vesting_delegations.collection.insertMany(return_vesting_delegations, {ordered: false}, function(err,res){
            if (err){
              console.log('return_vesting_delegations',err);
            }
          });
        }
        if (withdraw_vestings.length>0) {
          sdb_withdraw_vestings.collection.insertMany(withdraw_vestings, {ordered: false}, function(err,res){
            if (err){
              console.log('withdraw_vestings',err);
            }
          });
        }
        if (limit_order_creates.length>0) {
          sdb_limit_order_creates.collection.insertMany(limit_order_creates, {ordered: false}, function(err,res){
            if (err){
              console.log('limit_order_creates',err);
            }
          });
        }
        if (fill_vesting_withdraws.length>0) {
          sdb_fill_vesting_withdraws.collection.insertMany(fill_vesting_withdraws, {ordered: false}, function(err,res){
            if (err){
              console.log('fill_vesting_withdraws',err);
            }
          });
        }
        if (account_witness_votes.length>0) {
          sdb_account_witness_votes.collection.insertMany(account_witness_votes, {ordered: false}, function(err,res){
            if (err){
              console.log('account_witness_votes',err);
            }
          });
        }
        if (escrow_transfers.length>0) {
          sdb_escrow_transfers.collection.insertMany(escrow_transfers, {ordered: false}, function(err,res){
            if (err){
              console.log('escrow_transfers',err);
            }
          });
        }
      }//if numberofDays
    }//if block

    /** Store On DB Last Parsed Block */
    try {
      await sdb_states.updateOne({}, { blockNumber: blockNum, timestamp: blockTime }, { "multi" : false, "upsert" : true });
      console.log('Block Parsed', blockNum);
    } catch (err) {
      console.log('Error Saving', blockNum, err);
    }

    delete awaitingBlocks[0];
    awaitingBlocks = _.compact(awaitingBlocks);

    await parseNextBlock();

  } else {
    await utils.sleep(3010);
    await parseNextBlock();
  }
};

start();
