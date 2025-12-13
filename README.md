# Guitar4 - Browser-based Guitar Training Application

![Guitar4 Logo](artwork/images/logo.png)

Guitar4 is a comprehensive browser-based guitar training application that combines real-time pitch detection, interactive notation rendering, and performance analysis to help guitarists improve their skills.

## Features

- **Real-time Pitch Detection**: Monophonic and polyphonic pitch detection using advanced algorithms
- **Interactive Notation**: Render MusicXML with both standard notation and tablature
- **Performance Analysis**: Detailed feedback with Dynamic Time Warping alignment
- **Built-in Tuner**: Visual tuner with exponential smoothing
- **Exercise Library**: Support for custom and sample exercises
- **Progress Tracking**: Performance history and statistics
- **Settings Persistence**: Automatic saving and restoration of user preferences
- **Enhanced Notifications**: Type-based notifications with auto-dismiss

## Prerequisites

- Node.js v18 or higher
- Modern browser (Chrome, Firefox, Safari, Edge)
- Microphone access (for pitch detection)

## Installation

```bash
# Clone the repository
git clone [repository-url]
cd guitar4

# Install dependencies
npm install

# Start development server
npm start
```

The application will be available at `http://localhost:8000`

## Usage

1. **Start Audio Context**: Click "Start Audio Context" to enable audio features
2. **Load Exercise**: Upload a MusicXML file or select a sample exercise
3. **Practice**: Use playback controls to practice with visual feedback
4. **Analyze**: View detailed performance analysis and scores
5. **Tune**: Switch to Tuner tab for visual guitar tuning
6. **Settings**: Access Settings tab for persistent configuration options

## Settings & Persistence

Guitar4 automatically saves your preferences including:
- **Instrument Selection**: Chosen instrument and playback mode
- **Audio Settings**: Master and metronome volumes
- **Tuner Configuration**: Reference pitch and smoothing preferences
- **Practice Difficulty**: Tolerance settings for performance analysis
- **Keyboard Shortcuts**: Efficient workflow without mouse interaction

Settings persist across browser sessions and page refreshes. Use the Settings tab to:
- Export/Import configuration as JSON
- Reset to factory defaults
- Clear performance history

## Keyboard Shortcuts

- `Space`: Play/Pause
- `Escape`: Stop  
- `M`: Toggle metronome on/off
- `Ctrl/Cmd + Up Arrow`: Increase tempo by 5 BPM (max 300)
- `Ctrl/Cmd + Down Arrow`: Decrease tempo by 5 BPM (min 40)
- `Tab`: Cycle through tabs (practice → tuner → lessons → settings)

**Note**: Keyboard shortcuts are disabled when typing in input fields to prevent conflicts.

## Development

### Running Tests

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run governance validation
npm run lint:rules
```

### Project Structure

```
guitar4/
├── src/
│   ├── core/           # Core application modules
│   ├── utils/          # Utility modules
│   └── tests/          # Test files
├── assets/
│   ├── exercises/      # MusicXML exercise files
│   ├── samples/        # Audio sample files
│   └── models/         # ML model files
├── scripts/            # Build and validation scripts
├── index.html          # Main application
├── styles.css          # Application styles
└── server.js           # Development server
```

### Architecture

Guitar4 follows an event-driven architecture with clear separation of concerns:

- **Core Modules**: Independent modules for each major feature
- **Event Communication**: All modules communicate via events
- **Progressive Enhancement**: Graceful degradation for unsupported features
- **Performance First**: Optimized for real-time audio processing

See [ARCHITECTURE.md](architecture.md) for detailed technical documentation.

### Testing

The project uses a comprehensive testing strategy:

- **Unit Tests**: Test individual modules in isolation
- **Integration Tests**: Test module interactions and data flow
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Validate latency and memory requirements

See [TESTING.md](TESTING.md) for detailed testing procedures.

## Browser Compatibility

| Browser | Version | Features |
|---------|---------|----------|
| Chrome | 88+ | Full support (recommended) |
| Firefox | 85+ | Full support |
| Safari | 14+ | Full support |
| Edge | 88+ | Full support |

**Note**: Microphone access is required for pitch detection features.

## Performance Targets

- **Total Latency**: ≤ 80ms (audio input → visual feedback)
- **Pitch Detection**: ≤ 30ms
- **Memory Usage**: < 300MB
- **CPU Usage**: < 40% (combined)

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

### Coding Standards

- Follow ES6+ JavaScript standards
- Use JSDoc for all public methods
- Write tests before implementation
- Follow event-driven communication patterns
- Maintain ≥80% test coverage

See [RULES.md](RULES.md) for complete coding standards.

## Known Issues

- Microphone access may require HTTPS in some browsers
- Very large MusicXML files (>5MB) may load slowly
- Polyphonic detection requires model download on first use

## Roadmap

### Version 1.1
- [ ] Additional sample exercises
- [ ] Chord progression trainer
- [ ] Metronome improvements

### Version 1.2
- [ ] Practice mode with slow-down
- [ ] Scale trainer
- [ ] Sight-reading exercises

### Version 2.0
- [ ] Cloud sync for progress
- [ ] Social features
- [ ] Advanced analytics

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenSheetMusicDisplay](https://opensheetmusicdisplay.github.io/) for notation rendering
- [Tone.js](https://tonejs.github.io/) for audio synthesis
- [TensorFlow.js](https://tensorflow.org/js) for machine learning models
- The music education community for inspiration and feedback

## Support

- [Documentation](docs/)
- [GitHub Issues](https://github.com/username/guitar4/issues)
- [Discussions](https://github.com/username/guitar4/discussions)

---

**Made with ❤️ for guitarists worldwide**
