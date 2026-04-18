 
#ifndef NAVIGATION_H
#define NAVIGATION_H

#include <Arduino.h>

// Pin Definitions
#define TRIG_PIN 9
#define ECHO_PIN 10
#define BUZZER_PIN 11

// Constants
#define PEACEFUL_NOTE 1047 // C6

// Function Prototypes
void setupNavigation();
void runNavigationLoop();

#endif