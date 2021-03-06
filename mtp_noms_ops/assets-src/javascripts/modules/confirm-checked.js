// Batch validation module
'use strict';

exports.ConfirmChecked = {
  selector: '.js-ConfirmChecked',

  init: function () {
    this.cacheEls();
    this.bindEvents();
  },

  cacheEls: function () {
    this.$body = $('body');
    this.$form = $(this.selector);
  },

  bindEvents: function () {
    this.$form.on('click', ':submit', $.proxy(this.onSubmit, this));
  },

  // Called when the user submits the form,
  // either clicking 'Done' or 'Yes' in the popup.
  onSubmit: function (e) {
    var $el = $(e.target);
    var type = $el.val();

    if (type !== 'submit') {
      // If this is a 'Yes' click in the confirmation popup, so just
      // actually submit
      return;
    }

    e.preventDefault();
    $('#confirm-checked').trigger('dialogue:open');
  }
};
