$(function(){

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var context = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  var fbUsers = new Firebase("https://hacker-news.firebaseio.com/v0/user");
  var fbItems = new Firebase("https://hacker-news.firebaseio.com/v0/item");
  var userList = [];
  var feedItems = [];

  var init = function (users) {
    userList = users;
    decorate();

    //build initial feed with users and subscribe to changes
    users.forEach(function (id) {
      fbUsers.child(id).on('value', function (u) {
        var user = u.val();
        user.submitted.splice(30);
        mergeFeedItems(user.submitted);
      });
      subscribe(id);
    });

    var feedDiv = $("<div id='follow-hn-wrapper'><div id='follow-hn-feed'></div><a href='#' id='follow-hn-show-feed'>'</a></div>");
    $('body').append(feedDiv);

    $('#follow-hn-show-feed').click(function(e){
      e.preventDefault();
      $('#follow-hn-wrapper').toggleClass("visible");
    });
  }

  var addUser = function (userId) {
    userList.push(userId);
    chrome.storage.sync.set({'users':userList}, function () {
      //download comments for user, merge into feed, and subscribe to changes
      fbUsers.child(userId).on('value', function (u) {
        var user = u.val();
        user.submitted.splice(30);
        mergeFeedItems(user.submitted);
      });
      subscribe(userId);
    });
  }

  var removeUser = function (userId) {
    userList = userList.filter(function(id) {
      return id !== userId;
    });
    chrome.storage.sync.set({'users':userList}, function () {
      //filter out from feed
      console.log(feedItems.length);
      feedItems = feedItems.filter(function(item) {
        return item.by !== userId;
      });
      console.log(feedItems.length,feedItems);
      renderFeedItems();
    });
  }

  var mergeFeedItems = function (itemIds) {
    feedItems.splice(20);
    var oldIds = feedItems.map(function (el) {
      return el.id;
    });
    var newIds = itemIds.filter(function (id) {
      return oldIds.indexOf(id) < 0;
    });
    var count = 0;
    newIds.forEach(function(id) {
      feedItems.push({id: id});
      var j = feedItems.length - 1;
      fbItems.child(id).on('value', function (i) {
        feedItems[j] = i.val();
        count++;
        if (count == newIds.length) {
          renderFeedItems();
        }
      });
    });
  }

  var trunc = function (str) {
    return str && str.slice(0,30)+'...';
  };

  var renderFeedItems = debounce(function () {
    //render feed items
    //assign new class to anything posted in last 30s
    
    var target = $('#follow-hn-feed');
    var time = (new Date() / 1000) - 3600;
    feedItems.sort(function (a,b) {
      return b.time - a.time;
    });
    
    var ul = $('<ul>');
    feedItems.filter(function (el) {
      return el.type === 'comment' && el.by && el.text;
    }).map(function(el){
      return $("<li><a href='https://news.ycombinator.com/item?id="+el.id
        +"' class='"
        +(el.time > time ? "new follow-hn-feed-item" : "follow-hn-feed-item")
        +"'><strong>"+el.by+":</strong><br><em>"+trunc(el.text)+"</em></a></li>");
    }).forEach(function(el){
      ul.append(el);
    });

    target.html(ul);
  },500);

  chrome.storage.sync.get('users', function (items) {
    init(items.users || []);
  });

  var decorate = function () {
    $('span.comhead').each(function () {
      var html = $(this).html();
      var link = $(this).find('a').first().attr('href');
      if (link) {
        var userId = link.replace('user?id=','');
        if (userList.indexOf(userId) < 0) {
          $(this).html(html+" | <a href='#' class='follow-hn-add-user' data-user='"+userId+"'>follow user</a>");
        } else {
          $(this).html(html+" | <a href='#' class='follow-hn-remove-user' data-user='"+userId+"'>unfollow user</a>");
        }
      }
    });

    var handleAddClick = function (e) {
      e.preventDefault();
      addUser($(e.currentTarget).data('user'));
      $(e.currentTarget)
        .removeClass('follow-hn-add-user')
        .addClass('follow-hn-remove-user')
        .html('unfollow user')
        .one('click.followHN', handleRemoveClick);
    }

    var handleRemoveClick = function (e) {
      e.preventDefault();
      removeUser($(e.currentTarget).data('user'));
      $(e.currentTarget)
        .removeClass('follow-hn-remove-user')
        .addClass('follow-hn-add-user')
        .html('follow user')
        .one('click.followHN', handleAddClick);
    }

    $('a.follow-hn-add-user').one('click.followHN',handleAddClick);
    $('a.follow-hn-remove-user').one('click.followHN',handleRemoveClick);

  }

  var subscribe = function (id) {
    fbUsers.child(id).on('child_changed', function (changed) {
      var user = changed.val();
      if (userList.indexOf(user.id) > -1) {
        user.submitted.splice(20);
        mergeFeedItems(user.submitted);
      }
    });
  }

});
