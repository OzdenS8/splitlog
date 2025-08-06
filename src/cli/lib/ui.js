import blessed from "blessed";

const screen = blessed.screen({
  smartCSR: true,
  title: "Splitlog"
});

// Containers
const tabBoxes = {};
const tabButtons = {};
let tabLabels = [];
let activeTab = null;
let hasReceivedFirstMessage = false;

// UI Elements
const tabsButtonBar = blessed.box({
  top: 0,
  left: "center",
  width: "100%",
  height: 1,
  style: {
    bg: "black"
  }
});
screen.append(tabsButtonBar);

const helpLine = blessed.box({
  bottom: 0,
  height: 1,
  width: "100%",
  content: "Splitlog — live UDP log monitor by channel",
  style: {
    fg: "white",
    bg: "blue"
  }
});
screen.append(helpLine);


const welcomeBox = blessed.box({
  top: 'center',
  left: 'center',
  width: 'shrink',
  height: 'shrink',
  padding: { left: 2, right: 2 },
  content: `Waiting for logs...\n\nNo channels yet.`,
  style: {
    fg: "white",
    bg: "black",
    border: {
      fg: "white"
    }
  },
  border: 'line'
});

screen.append(welcomeBox);

export function updateWelcomeBox( message ) {
  welcomeBox.setContent( message );
  screen.render();
}


// Utility: Updates help line
function updateHelpLine() {
  helpLine.setContent(
    `Press ${tabLabels.map((_, i) => i + 1).join(", ")} to switch tabs. Press Ctrl-C to exit.`
  );
}

// Utility: Switch active tab
function switchTab(index) {
  if (tabLabels[index] === undefined || index === activeTab) return;

  Object.values(tabBoxes).forEach(box => box.hide());
  Object.entries(tabButtons).forEach(([name, btn], i) => {
    btn.style.bg = (i === index) ? "green" : "gray";
  });

  const label = tabLabels[index];
  tabBoxes[label].show();
  activeTab = index;
  screen.render();
}

// Create a new tab dynamically
function createTab( channel ) {
  const tabBox = blessed.box({
    label: channel,
    border: "line",
    width: "100%",
    height: "100%-3",
    top: 2,
    left: 0,
    scrollable: true,
    alwaysScroll: true,
    tags: true,
    hidden: true
  });

  screen.append(tabBox);
  tabBoxes[ channel ] = tabBox;

  const index = tabLabels.length;
  

// Calculate left offset BEFORE adding the new tab label
let leftOffset = 0;
for (let label of tabLabels) {
  leftOffset += label.length + 2 + 1; // content + padding + spacing
}

const button = blessed.button({
  parent: tabsButtonBar,
  mouse: true,
  keys: true,
  shrink: true,
  padding: { left: 1, right: 1 },
  content: channel,
  left: leftOffset,
  style: {
    bg: "gray",
    fg: "black",
    focus: { bg: "blue" },
    hover: { bg: "lightgreen" }
  }
});

  tabButtons[ channel ] = button;
  tabLabels.push (channel );
  button.on( "press", () => switchTab( index ) );
  

  // Key shortcut
  screen.key(( index + 1 ).toString(), () => switchTab( index ));

  if ( activeTab === null ) {
    switchTab( 0 ); // First created tab becomes active
  }

  updateHelpLine();
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  return date.toTimeString().split(' ')[0]; // → "08:30:14"
}

// Append message to appropriate tab
export function addMessage( channel, message, timestamp ) {
  if ( !hasReceivedFirstMessage ) {
    welcomeBox.hide();
    hasReceivedFirstMessage = true;
  }

  if (!tabBoxes[channel]) {
    createTab(channel);
  }

  const box = tabBoxes[channel];
  box.insertBottom( `{gray-fg}[${ formatTimestamp( timestamp ) }]{/gray-fg} ${ message }\n` );
  box.setScrollPerc(100);

  if (channel === tabLabels[activeTab]) {
    screen.render();
  }
}

export function resetAllTabs() {
  Object.values(tabBoxes).forEach(box => {
    box.setContent('');        // Clear all content
    box.setScrollPerc(0);      // Scroll to top (optional)
  });
  screen.render();
}


// Exit keys
screen.key([ "q", "C-c" ], () => process.exit( 0 ));

// Render initial UI
screen.render();

