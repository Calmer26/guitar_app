#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

class GovernanceValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }
  
  validate() {
    console.log('🔍 Validating RULES.md compliance...\n');
    
    this.checkGovernanceFiles();
    this.checkPreCommitHook();
    this.checkCodingStandards();
    
    this.printResults();
    
    return this.errors.length === 0;
  }
  
  checkGovernanceFiles() {
    const requiredFiles = [
      '.cline/CLINE_TODO.md',
      'CLINE_MEMORY.md',
      'RULES.md',
      'MASTER_PROMPT.md',
      'architecture.md',
      'TESTING.md',
      'DEV_NOTES.md'
    ];
    
    requiredFiles.forEach(file => {
      if (!existsSync(file)) {
        this.errors.push(`Missing required file: ${file}`);
      }
    });
    
    if (this.errors.length === 0) {
      console.log('✅ Governance files present');
    }
  }
  
  checkPreCommitHook() {
    const hookPath = '.git/hooks/pre-commit';
    
    if (!existsSync(hookPath)) {
      this.warnings.push('Pre-commit hook not installed');
      console.log('⚠️  Pre-commit hook not configured');
    } else {
      console.log('✅ Pre-commit hooks configured');
    }
  }
  
  checkCodingStandards() {
    // Check if core modules have JSDoc
    const coreModules = [
      'src/core/exerciseLoader.js',
      'src/core/notationRenderer.js',
      'src/core/playbackEngine.js',
      'src/core/pitchDetector.js',
      'src/core/polyphonicDetector.js',
      'src/core/analyzer.js',
      'src/core/tuner.js',
      'src/core/uiManager.js',
      'src/core/storage.js'
    ];
    
    coreModules.forEach(module => {
      if (existsSync(module)) {
        const content = readFileSync(module, 'utf8');
        
        // Check for console.log
        if (content.match(/console\.log\(/)) {
          this.warnings.push(`${module} contains console.log statements`);
        }
        
        // Check for JSDoc
        if (!content.includes('@param') && !content.includes('@returns')) {
          this.warnings.push(`${module} may be missing JSDoc comments`);
        }
      }
    });
    
    if (this.warnings.length === 0) {
      console.log('✅ Coding standards appear compliant');
    }
  }
  
  printResults() {
    console.log('\n' + '='.repeat(50));
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ All governance checks passed!');
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

const validator = new GovernanceValidator();
const success = validator.validate();

process.exit(success ? 0 : 1);
