Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force -Path "data\audio" | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$out = Join-Path (Get-Location) "data\audio\demo-speech-raw.wav"
$synth.SetOutputToWaveFile($out)
$synth.Speak("Hello fellow toastmasters. Today I want to talk about practice. Um I basically think that you know clear pacing matters. So let us pause instead of using filler words.")
$synth.Dispose()
Write-Host "Wrote $out"
