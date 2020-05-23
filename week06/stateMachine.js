function match(str) {
  let state = start;
  for (let c of str) {
    state = state(c);
  }
  return state === end;
}

function start(c) {
  if (c === 'a') {
    return foundA;
  } else {
    return start;
  }
}

function foundA(c) {
  if (c === 'b') {
    return foundB;
  } else {
    return start(c);
  }
}

function foundB(c) {
  if (c === 'a') {
    return foundSecondA;
  } else {
    return start;
  }
}

function foundSecondA(c) {
  if (c === 'b') {
    return foundSecondB;
  } else {
    return start(c);
  }
}

function foundSecondB(c) {
  if (c === 'a') {
    return foundThirdA;
  } else {
    return start;
  }
}

function foundThirdA(c) {
  if (c === 'b') {
    return foundThirdB;
  } else {
    return start(c);
  }
}

function foundThirdB(c) {
  if (c === 'x') {
    return end;
  } else {
    return foundSecondB(c);
  }
}

function end() {
  return end;
}
