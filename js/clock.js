
var Counter  = function(obj) {
  obj = obj || {increment: 1};
  var self = this;
  
  self.from = obj.from || 0;
  self.counter = self.from ;
  self.to = obj.to || 10;
  self.increment = obj.increment || 1;
  self.interval = obj.interval || 500;
  self.callback = (obj.callback && typeof(obj.callback) === "function") ? obj.callback : function(){};
  self.onFinish = (obj.onFinish && typeof(obj.onFinish) === "function") ? obj.onFinish : function(){};
  return {
    setRange : function(range) {
      self.from = range[0];
      self.to = range[1];
    },
    setInterval : function(interval) {
      self.interval = interval;
    },
    getTo : function() {
      return self.to;
    },
    getCounter : function() {
      return self.counter;
    },
    setCounter : function(value) {
      self.counter = value;
    },
    start: function () {
      this.intervalObjec = setInterval(function () {
        self.counter += self.increment;
        if(self.counter >= self.to) {
          self.onFinish(self.to);
        } else {
          self.callback(self.counter);
        }
        
      }, self.interval);
    },

    pause: function () {
      clearInterval(this.intervalObjec);
      delete this.intervalObjec;
    },

    resume: function () {
      if (!this.intervalObjec) this.start();
    },

    stop : function() {
      clearInterval(this.intervalObjec);
      delete this.intervalObjec;
      self.counter = self.from;
    }
  };
}
