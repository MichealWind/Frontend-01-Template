const css = require('css');

let currentToken = null;
let currentAttribute = null;
let currentTextNode = null;

const tokenStack = [{type: 'document', children: []}];

let rules = [];
function addCssRules(text) {
  let ast = css.parse(text);
  rules.push(...ast.stylesheet.rules);
}

function computeCSS(element) {
  const elements = tokenStack.slice().reverse();
  if (!element.computedStyle) {
    element.computedStyle = {};
  }

  rules.forEach(rule => {
    let matched = false;
    const selectorParts = rule.selectors[0].split(' ').reverse();

    if (!match(element, selectorParts[0])) {
      return;
    }

    let j = 1;
    for (let i = 0; i < elements.length; i++) {
      if (match(elements[i], selectorParts[j])) {
        j++;
      }
    }
    if (j >= selectorParts.length) {
      matched = true;
    }
    if (matched) {
      const sp = specificity(rule.selectors[0]);
      const computedStyle = element.computedStyle;
      for (let dec of rule.declarations) {
        if (!computedStyle[dec.property]) {
          computedStyle[dec.property] = {};
        }
        if (
          !computedStyle[dec.property].specificity ||
          compare(computedStyle[dec.property].specificity, sp) < 0
        ) {
          computedStyle[dec.property].value = dec.value;
          computedStyle[dec.property].specificity = sp;
        }
      }
      console.log('Element: ', element);
    }
  });
}

function specificity(selector) {
  const p = [0, 0, 0, 0];
  const selectorParts = selector.split(' ');
  for (let part of selectorParts) {
    if (part.charAt(0) === '#') {
      p[1]++;
    } else if (part.charAt(0) === '.') {
      p[2]++;
    } else {
      p[3]++;
    }
  }
  return p;
}

function compare(sp1, sp2) {
  if (sp1[0] - sp2[0]) {
    return sp1[0] - sp2[0];
  }
  if (sp1[1] - sp2[1]) {
    return sp1[1] - sp2[1];
  }
  if (sp1[2] - sp2[2]) {
    return sp1[2] - sp2[2];
  }
  return sp1[3] - sp2[3];
}

function match(element, selector) {
  if (!selector || !element.attributes) {
    return false;
  }

  if (selector.charAt(0) === '#') {
    const attr = element.attributes.filter(attr => attr.name === 'id')[0];
    if (attr && attr.value === selector.replace('#', '')) {
      return true;
    } 
  } else if (selector.charAt(0) === '.') {
    const attr = element.attributes.filter(attr => attr.name === 'class')[0];
    if (attr && attr.value.indexOf(selector.replace('.', '')) !== -1) {
      return true;
    }
  } else if (selector === element.tagName) {
    return true;
  }
  return false;
}

function emit(token) {
  let top = tokenStack[tokenStack.length - 1];
  if (token.type === 'startTag') {
    let element = {
      type: 'element',
      children: [],
      attributes: [],
    };

    element.tagName = token.tagName;

    for (let p in token) {
      if (p !== 'type' && p !== 'tagName' && p !== 'isSelfClosingTag') {
        element.attributes.push({
          name: p,
          value: token[p],
        });
      }
    }

    computeCSS(element);

    top.children.push(element);
    element.parent = top;

    if (!token.isSelfClosingTag) {
      tokenStack.push(element);
    }

    currentTextNode = null;
  } else if (token.type === 'endTag') {
    if (top.tagName !== token.tagName) {
      throw new Error('Tag name is not match');
    } else {
      if (top.tagName === 'style') {
        addCssRules(top.children[0].content);
      }
      tokenStack.pop();
    }
    currentTextNode = null;
  } else if (token.type === 'text') {
    if (!currentTextNode) {
      currentTextNode = {
        type: 'text',
        content: '',
      };
      top.children.push(currentTextNode);
    }
    currentTextNode.content += token.content;
  }
}

const EOF = Symbol('EOF');

function data(c) {
  if (c === '<') {
    return tagOpen;
  } else if (c === EOF) {
    emit({type: 'EOF'});
    return;
  } else {
    emit({ type: 'text', content: c });
    return data;
  }
}

function tagOpen(c) {
  if (c === '/') {
    return endTagOpen;
  } else if (c.match(/^[a-zA-Z]$/)) {
    currentToken = {
      type: 'startTag',
      tagName: '',
    };
    return tagName(c);
  } else {
    return;
  }
}

function endTagOpen(c) {
  if (c.match(/^[a-zA-Z]$/)) {
    currentToken = {
      type: 'endTag',
      tagName: '',
    };
    return tagName(c);
  } else {
    return;
  }
}

function tagName(c) {
  if (c.match(/^[a-zA-Z]$/)) {
    currentToken.tagName += c.toLowerCase();
    return tagName;
  } else if (c.match(/^[\t\n\f ]$/)) {
    return beforeAttributeName;
  } else if (c === '/') {
    return selfClosingStartTag;
  } else if (c === '>') {
    emit(currentToken);
    return data;
  } else {
    return tagName;
  }
}

function beforeAttributeName(c) {
  if (c.match(/^[\t\n\f ]$/)) {
    return beforeAttributeName;
  } else if (c === '/' || c === '>' || c === EOF) {
    return afterAttributeName(c);
  } else if (c === '=') {

  } else {
    currentAttribute = {
      name: '',
      value: '',
    };
    return attributeName(c);
  }
}

function afterAttributeName(c) {
  if (c === '>') {
    setTokenAttribute();
    emit(currentToken);
    return data;
  } else if (c === '/') {
    setTokenAttribute();
    return selfClosingStartTag;
  }
}

function attributeName(c) {
  if (c.match(/^[\t\n\f ]$/) || c === '/' || c === EOF || c === '>') {
    return afterAttributeName(c);
  } else if (c === '=') {
    return beforeAttributeValue;
  } else if (c === '\u0000') {

  } else if (c === '\'' || c === '"' || c === '<') {

  } else {
    currentAttribute.name += c;
    return attributeName;
  }
}

function beforeAttributeValue(c) {
  if (c.match(/^[\t\n\f ]$/) || c === '/' || c === EOF || c === '>') {
    return beforeAttributeValue;
  } else if (c === '\'') {
    return singleQuotedAttributeValue;
  } else if (c === '"') {
    return doubleQuotedAttributeValue;
  } else if (c === '>') {

  } else {
    return unQuotedAttributeValue(c);
  }
}

function doubleQuotedAttributeValue(c) {
  if (c === '"') {
    setTokenAttribute();
    return afterQuotedAttributeValue;
  } else if (c === '\u0000') {

  } else if (c === EOF) {

  } else {
    currentAttribute.value += c;
    return doubleQuotedAttributeValue;
  }
}

function singleQuotedAttributeValue(c) {
  if (c === '\'') {
    setTokenAttribute();
    return afterQuotedAttributeValue;
  } else if (c === '\u0000') {

  } else if (c === EOF) {

  } else {
    currentAttribute.value += c;
    return singleQuotedAttributeValue;
  }
}

function afterQuotedAttributeValue(c) {
  if (c.match(/^[\t\n\f ]$/)) {
    return beforeAttributeName;
  } else if (c === '/') {
    return selfClosingStartTag;
  } else if (c === '>') {
    setTokenAttribute();
    emit(currentToken);
    return data;
  } else {
    
  }
}

function unQuotedAttributeValue(c) {
  if (c.match(/^[\t\n\f ]$/)) {
    setTokenAttribute();
    return beforeAttributeName;
  } else if (c === '/') {
    setTokenAttribute();
    return selfClosingStartTag;
  } else if (c === '>') {
    setTokenAttribute();
    emit(currentToken);
    return data;
  } else if (c === '\u0000') {

  } else if (c === '\'' || c === '"' || c === '<' || c === '=' || c === '`') {

  } else if (c === EOF) {

  } else {
    currentAttribute.value += c;
    return unQuotedAttributeValue;
  }
}

function selfClosingStartTag(c) {
  if (c === '>') {
    currentToken.isSelfClosingTag = true;
    emit(currentToken);
    return data;
  }
}

function setTokenAttribute() {
  if (currentAttribute && currentToken) {
    currentToken[currentAttribute.name] = currentAttribute.value;
  }
  currentAttribute = null;
}

function parseHTML(html) {
  let state = data;
  for (let c of html) {
    state = state(c);
  }
  state = state(EOF);
  return tokenStack[0];
}

module.exports.parseHTML = parseHTML;
