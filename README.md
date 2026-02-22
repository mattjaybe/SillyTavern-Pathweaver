# 🧭 Pathweaver for SillyTavern

> **Elevate your stories and roleplays from good to unforgettable. Pathweaver injects fresh ideas, unexpected twists, and genre-perfect moments exactly when you need them, making every session feel like a professionally crafted story.**

## 🆕 What's New

### ***ver 1.2 & 1.2.1***
- Added option to hide the animated bar in the settings
- 1.2.1: Ensures that the hide/show button remains clickable when the <a href="https://github.com/mattjaybe/SillyTavern-Larson">Larson extension</a> is installed

### ***ver 1.1***
- You can now enable streaming in settings, which streams the suggestions to each card one at a time rather than waiting for all of them to be filled. Works with Ollama, OpenAI-compatible endpoints, and any Connection Profile/Main API that supports streaming
- Setting to change the font of the title 'Pathweaver' on the bar, or even hide it
- Misc. bug fixes some users pointed out

### ***ver 1.0.5***
- Insert Type: optional feature to copy/insert/send suggestions inside either [OOC: ] or [Director: ]
- Added a field for custom OpenAI-compatible endpoints that require an API key

![Version](https://img.shields.io/badge/SillyTavern-v1.12%2B-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![GitHub stars](https://img.shields.io/github/stars/mattjaybe/SillyTavern-Pathweaver?style=social)
![GitHub issues](https://img.shields.io/github/issues/mattjaybe/SillyTavern-Pathweaver)

**Pathweaver** is a creative companion extension for [SillyTavern](https://github.com/SillyTavern/SillyTavern). It analyzes your current chat context and generates Suggestions — options for where the story could go next. Whether you need a sudden plot twist, a new character introduction, or just a little nudge to break writer's block, Pathweaver provides up to 6 distinctive suggestions for every request.

<p align="center">
  <a href="https://github.com/user-attachments/assets/6279f0a6-e0fe-4315-bdea-c392db73d5e8"><img src="https://github.com/user-attachments/assets/6279f0a6-e0fe-4315-bdea-c392db73d5e8" alt="Pathweaver" width="70%"></a>
  <br>
  <sub><em>The Pathweaver bar - Director Mode, Context-Aware, Plot Twist, New Character, Explicit, Custom, and Genre suggestions.</em></sub>
</p>

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 🎯 Smart Generation
- **Context-Aware**: Analyzes 2-10 messages for coherent suggestions
- **Director Mode**: Single Scene or Story Beats for precise control
- **Genre Specialization**: 9 built-in genres + unlimited custom styles

</td>
<td width="50%">

### ⚙️ Flexible & Powerful
- **Multiple Backends**: Main API, Connection Profiles, Ollama, OpenAI-compatible
- **Responsive Design**: Works on desktop, tablets, and smartphones
- **Seamless Integration**: Glass UI design matches SillyTavern perfectly

</td>
</tr>
</table>

<p align="center">
  <a href="https://github.com/user-attachments/assets/323e15fa-5149-4c54-b1c9-2e64b0a7123a"><img src="https://github.com/user-attachments/assets/323e15fa-5149-4c54-b1c9-2e64b0a7123a" alt="Pathweaver - Settings" width="70%"></a>
  <br>
  <sub><em>Each card with option to Copy (copies to clipboard), Insert (add to SillyTavern's input but doesn't send) or Send (immediately sends to the AI.)

</em></sub>
</p>

---

## 🎮 How It Works

Pathweaver adds a **Control Bar** above your chat input. Click any button to instantly generate up to 6 suggestions.

### The Categories

| Icon | Category | Usage |
|------|----------|-------|
| 🎬 | **Director** | Opens a simplified input box. You type a prompt, AI gives you tailored suggestions. |
| 🧭 | **Context-Aware** | "What happens next?" Smart suggestions based on story logic and context. |
| 🔀 | **Plot Twist** | Throws a curveball. Unexpected events, betrayals, and shocks. |
| 👤+ | **New Character** | Adds a new character to the story based on a variety of character tropes. |
| 🔥 | **Explicit** | (Optional) NSFW Spicy suggestions. Only one hand needed. |
| 🎭 | **Genres** | A dropdown menu with specific genre flavors: Horror, Romance, Sci-Fi, etc. |
| 📚 | **Custom** | Create custom suggestions, such as genre mashups like "Cyberpunk-Noir" or "Cozy-Horror". |

<p align="center">
  <a href="https://github.com/user-attachments/assets/34441011-cc9c-4ee7-9227-6563e30f5886"><img src="https://github.com/user-attachments/assets/34441011-cc9c-4ee7-9227-6563e30f5886" alt="Pathweaver - Director Mode" width="70%"></a>
  <br>
  <sub><em>Direct your next scene with Single Scene or Story Beat modes.
</em></sub>
</p>

---

## 🛠️ Installation

1. Open SillyTavern and click the **Extensions** button (puzzle piece icon)
2. Select **Install Extension**
3. Paste this URL:
   ```
   https://github.com/mattjaybe/SillyTavern-Pathweaver
   ```
4. Click **Install** and refresh SillyTavern

---

## 🚀 Quick Start

1. **Install the extension** (see Installation above)
2. **Refresh SillyTavern** - You'll see the Pathweaver bar appear above your chat input
3. **Start a conversation** with any character
4. **Click any button** on the bar (try 🧭 Context-Aware first!)
5. **Pick a suggestion** and watch your story unfold

That's it! Pathweaver works with your existing API setup - no additional configuration needed.

---

## ⚙️ Configuration

Access Pathweaver settings by clicking the ⚙️ gear icon on the right side of the Pathweaver bar or in SillyTavern's extension menu.

### Generation Engine

| Engine | Description |
|--------|-------------|
| **Main (API)** | Uses your currently active SillyTavern API. Easiest setup. |
| **Connection Profile** ⭐ | Recommended. Select a Connection Profile saved in SillyTavern. |
| **Ollama** | Connect directly to a local Ollama instance (default: `http://127.0.0.1:11434`). |
| **OpenAI Compatible** | Connect to KoboldCPP, LM Studio, vLLM, or other OpenAI-compatible endpoints. |

### Settings

- **Show Explicit**: Toggle the visibility of the "Explicit" (Fire icon) category.
- **Button Size**: Compact, Default, or Max.
- **Font Size**: Adjust the size of the text from Small, Default, or Large.
- **Title Font**: Change the font of 'Pathweaver' on the bar, or hide it altogether.
- **Stream Suggestions**: Cards appear in real-time as each suggestion is generated.
- **Minimal Mode**: Arrow on the bar hides and shows Pathweaver.

<p align="center">
  <a href="https://github.com/user-attachments/assets/380434d3-3ab6-4e1c-857c-ad5bc5d660aa"><img src="https://github.com/user-attachments/assets/380434d3-3ab6-4e1c-857c-ad5bc5d660aa" alt="Pathweaver - Settings" width="70%"></a>
  <br>
  <sub><em>Quickly and easily adjust the Pathweaver settings to your preferences.
</em></sub>
</p>

---

## My Other SillyTavern Extensions: EchoChamber & Larson

### EchoChamber

[EchoChamber](https://github.com/mattjaybe/SillyTavern-EchoChamber/tree/main) is a powerful extension that generates a live reaction feed alongside your story. Whether it's a salt-fueled Discord chat, a viral Twitter feed, dramatic breaking news, or a sarcastic MST3K roasting session—EchoChamber immerses you in the world with AI-generated audience reactions.

<p align="center">
  <a href="https://github.com/user-attachments/assets/6cf79997-eab2-4fc5-b9b8-ba38673d4fd0"><img src="https://github.com/user-attachments/assets/6cf79997-eab2-4fc5-b9b8-ba38673d4fd0" alt="Pathweaver - Settings" width="70%"></a>
  <br>
  <sub><em>Quickly and easily adjust the Pathweaver settings to your preferences.
</em></sub>
</p>

### Larson

<a href="https://github.com/mattjaybe/SillyTavern-Larson">Larson</a> is a beautiful animated status bar for SillyTavern with 8 unique styles (Gradient, Breathe, Pulse, Cylon, Segment, Glitch, Liquid, Convergence). Independent animations for Generating/Thinking/Idle states, custom theme creator, mobile-optimized UI, and smart LLM thinking detection.

<p align="center">
  <img src="https://github.com/user-attachments/assets/e9817bb3-23d1-48e8-acb2-ed29493cd77e" />
</p>

---

## 🌟 Extras

### 🎨 EyeCare Theme

The screenshots use a custom high-contrast theme optimized for readability. Copy the JSON below and save as a `.json` file to import into SillyTavern:

<details>
<summary><strong>Click to view Theme JSON</strong></summary>

```json
{
    "name": "EyeCare",
    "blur_strength": 0,
    "main_text_color": "rgba(230, 240, 255, 1)",
    "italics_text_color": "rgba(150, 220, 255, 1)",
    "underline_text_color": "rgba(255, 200, 100, 1)",
    "quote_text_color": "rgba(180, 255, 180, 1)",
    "blur_tint_color": "rgba(15, 20, 28, 1)",
    "chat_tint_color": "rgba(15, 20, 28, 1)",
    "user_mes_blur_tint_color": "rgba(22, 28, 38, 1)",
    "bot_mes_blur_tint_color": "rgba(18, 24, 32, 1)",
    "shadow_color": "rgba(0, 0, 0, 1)",
    "shadow_width": 0,
    "border_color": "rgba(70, 100, 140, 1)",
    "font_scale": 1,
    "fast_ui_mode": true,
    "waifuMode": false,
    "avatar_style": 2,
    "chat_display": 1,
    "toastr_position": "toast-top-right",
    "noShadows": true,
    "chat_width": 50,
    "timer_enabled": false,
    "timestamps_enabled": true,
    "timestamp_model_icon": true,
    "mesIDDisplay_enabled": false,
    "hideChatAvatars_enabled": false,
    "message_token_count_enabled": false,
    "expand_message_actions": true,
    "enableZenSliders": false,
    "enableLabMode": false,
    "hotswap_enabled": false,
    "custom_css": "",
    "bogus_folders": false,
    "zoomed_avatar_magnification": false,
    "reduced_motion": true,
    "compact_input_area": false,
    "show_swipe_num_all_messages": false,
    "click_to_edit": false,
    "media_display": "list"
}
```
</details>

### 🎙️ Featured Scenario: Real Talk Podcast

Explore Pathweaver with the custom-made Real Talk Podcast story:

<table>
  <tr>
    <td width="35%" valign="top">
      <img src="https://github.com/user-attachments/assets/beee7c3e-b40b-4f2d-a857-79329ab7038b" width="100%" alt="Real Talk Podcast Card" />
      <p align="center"><sub><em>Right-click & Save to import</em></sub></p>
    </td>
    <td width="65%" valign="top">
      <strong>The Story:</strong>
      <blockquote>
        Victoria Cross, 38, built her podcast empire dissecting male mediocrity and modern dating's failures—until Daniel, 18, calls in and systematically dismantles her worldview on air. Their explosive debates accidentally spark the "New Pond Movement," urging older women to pursue younger men and leave the "stagnant pond" behind.
      </blockquote>
      <p><strong>Import Options:</strong></p>
      <ul>
        <li>Download the image and import into SillyTavern</li>
        <li>Or <a href="https://gist.githubusercontent.com/mattjaybe/8856eecdb2ada535095cbc35e107a4dc/raw/6490ea9f134a1c71272f0014fec31bc068d62469/realtalk-charactercard.json">download the character card JSON</a></li>
      </ul>
    </td>
  </tr>
</table>

---

## 🤝 Contributing

Love Pathweaver? Here's how you can help:

- ⭐ **Star this repo** to show support
- 🐛 **Report bugs** via [Issues](https://github.com/mattjaybe/SillyTavern-Pathweaver/issues)
- 💡 **Request features** you'd love to see
- 🎨 **Share custom styles** with the community ([Discussion](link))
- 🔧 **Submit PRs** for improvements
- 📣 **Spread the word** and tell your friends about Pathweaver

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ for the SillyTavern community
</p>













