'use strict';

/**
 * device-aware helper (global baseline):
 * phone | tablet | desktop + input-touch | input-fine
 */
var DEVICE = DEVICE || {};

DEVICE.profile = {
  form: 'desktop',
  touch: false,
  fine: true
};

DEVICE.apply = function () {
  var coarse = false;
  var fine = true;
  var narrow = false;
  var mid = false;
  try {
    coarse = window.matchMedia('(pointer: coarse)').matches;
    fine = window.matchMedia('(pointer: fine)').matches;
    narrow = window.matchMedia('(max-width: 700px)').matches;
    mid = window.matchMedia('(min-width: 701px) and (max-width: 1100px)').matches;
  } catch (err) { /* ignore */ }

  var hasTouchPoints = false;
  try {
    hasTouchPoints = (navigator.maxTouchPoints || 0) > 0 || ('ontouchstart' in window);
  } catch (e2) { /* ignore */ }

  var touch = !!coarse || (hasTouchPoints && narrow);

  var form = 'desktop';
  if (touch) {
    form = narrow ? 'phone' : 'tablet';
  } else if (narrow && !fine) {
    form = 'phone';
    touch = true;
  } else if (mid && !fine) {
    form = 'tablet';
  }

  var html = document.documentElement;
  html.classList.remove(
    'device-phone', 'device-tablet', 'device-desktop',
    'input-touch', 'input-fine'
  );
  html.classList.add('device-' + form);
  html.classList.add(touch ? 'input-touch' : 'input-fine');

  DEVICE.profile = {
    form: form,
    touch: touch,
    fine: !!(fine && !coarse)
  };

  return DEVICE.profile;
};

DEVICE.isTouch = function () {
  return !!(DEVICE.profile && DEVICE.profile.touch);
};

DEVICE.form = function () {
  return (DEVICE.profile && DEVICE.profile.form) || 'desktop';
};

DEVICE.onChange = function (fn) {
  if (typeof fn !== 'function') return;
  var run = function () {
    DEVICE.apply();
    fn(DEVICE.profile);
  };
  try {
    window.matchMedia('(pointer: coarse)').addEventListener('change', run);
    window.matchMedia('(pointer: fine)').addEventListener('change', run);
    window.matchMedia('(max-width: 700px)').addEventListener('change', run);
  } catch (e) { /* older browsers */ }
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);
};
