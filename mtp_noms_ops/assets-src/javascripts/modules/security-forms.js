// Security module
/* globals prisonData */
'use strict';

var LegacySecurityForms = {
  init: function () {
    if (!$('.mtp-security-form').length) {
      return;
    }

    this.bindAmountPatternSelection();
    this.bindPaymentSourceSelection();
    this.bindPrisonSelection();
  },

  bindAmountPatternSelection: function () {
    var $patternSelect = $('#id_amount_pattern');
    var valueGetter = function () {
      return $patternSelect.val();
    };

    // if $patternSelect doesn't exist, check if the radio varient exists instead
    if (!$patternSelect.length && $('[name=amount_pattern]')) {
      $patternSelect = $('[name=amount_pattern]');
      valueGetter = function () {
        return $patternSelect.filter(':checked').val();
      };
    }

    var $exactWrapper = $('#id_amount_exact-wrapper');
    var $penceWrapper = $('#id_amount_pence-wrapper');

    var hideWrapper = function (wrapper) {
      wrapper.removeClass('form-group-error').hide();
      wrapper.find('input').val('').removeClass('form-control-error');
      wrapper.find('.error-message').remove();
    };

    function update () {
      switch (valueGetter()) {
        case 'exact':
          $exactWrapper.show();
          hideWrapper($penceWrapper);
          break;
        case 'pence':
          hideWrapper($exactWrapper);
          $penceWrapper.show();
          break;
        default:
          hideWrapper($exactWrapper);
          hideWrapper($penceWrapper);
      }
    }

    $patternSelect.change(update);
    update();
  },

  bindPaymentSourceSelection: function () {
    var $paymentSourceSelect = $('#id_source, #id_method');
    var $bankTransferContainers = $('.mtp-payment-method-options--bank-transfer');
    var $debitCardContainers = $('.mtp-payment-method-options--debit-card');

    function update () {
      $bankTransferContainers.hide();
      $debitCardContainers.hide();
      switch ($paymentSourceSelect.val()) {
        case 'bank_transfer':
          $bankTransferContainers.show();
          break;
        case 'online':
        case 'cheque':
          $debitCardContainers.show();
          break;
      }
    }

    $paymentSourceSelect.change(update);
    update();
  },

  bindPrisonSelection: function () {
    var $prisonSelect = $('#id_prison');
    if ($prisonSelect.length === 0) {
      return;
    }
    var $prisonOptions = $('option', $prisonSelect[0]);
    var prisonCount = $prisonOptions.length - 1;
    var $allPrisonsOption = $($prisonOptions[0]);
    var allPrisonsOptionText = $allPrisonsOption.text();

    var $regionSelect = $('#id_prison_region');
    var $categorySelect = $('#id_prison_category');
    var $populationSelect = $('#id_prison_population');

    $prisonOptions.each(function () {
      var $option = $(this);
      var nomisID = $option.val();
      if (!nomisID) {
        return;
      }
      $option.data(prisonData[nomisID] || {});
    });

    function update () {
      var selectedRegion = $regionSelect.val();
      var selectedCategory = $categorySelect.val();
      var selectedPopulation = $populationSelect.val();
      var disabledPrisonsCount = 0;

      $prisonOptions.each(function () {
        var $option = $(this);
        if (!$option.val()) {
          return;
        }
        var optionData = $option.data();
        /* eslint-disable no-extra-parens */
        var optionDisabled = (
          (selectedRegion && optionData.region && optionData.region !== selectedRegion) ||
          (selectedCategory && !optionData.categories[selectedCategory]) ||
          (selectedPopulation && !optionData.populations[selectedPopulation])
        );
        /* eslint-enable no-extra-parens */
        $option.prop('disabled', optionDisabled);
        if (optionDisabled) {
          disabledPrisonsCount++;
          $option.hide();
        } else {
          $option.show();
        }
      });
      if (disabledPrisonsCount === prisonCount) {
        $allPrisonsOption.text(django.gettext('No matching prisons')).click();
        $prisonSelect.prop('disabled', true);
      } else {
        $allPrisonsOption.text(allPrisonsOptionText);
        $prisonSelect.prop('disabled', false);
      }
    }

    $regionSelect.change(update);
    $categorySelect.change(update);
    $populationSelect.change(update);
    update();
  }
};

exports.SecurityForms = {
  init: function () {
    LegacySecurityForms.init();

    if ($('.mtp-security-advanced-search').length) {
      this.bindConditionalShowHideSelection('amount_pattern');
      this.bindConditionalShowHideSelection('prison_selector');
      this.bindConditionalShowHideSelection('payment_method');
    }
    if ($('.mtp-job-information-form').length) {
      this.bindConditionalShowHideSelection('job_title');
    }
  },

  bindConditionalShowHideSelection: function (inputName) {
    var $conditionalSelector = $('[name=' + inputName + ']');

    if (!$conditionalSelector.length) {
      return;
    }

    var $conditionalContainer = $conditionalSelector.parents('.mtp-conditional-container');


    function update () {
      var selectedValue = $conditionalSelector.filter(':checked').val();
      var wrapperToReveal = $('#mtp-conditional-' + inputName + '-' + selectedValue);
      var wrappersToHide = $conditionalContainer.find('.mtp-conditional-wrapper').not(wrapperToReveal);

      wrapperToReveal.show();

      wrappersToHide.find('input').val('').removeClass('form-control-error');
      wrappersToHide.find('.form-group-error').removeClass('form-group-error');
      wrappersToHide.find('.error-message').remove();
      wrappersToHide.hide();
    }

    $conditionalSelector.change(update);
    update();
  }
};
