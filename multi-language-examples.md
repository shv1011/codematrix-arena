# Multi-Language Code Examples

The system now supports code evaluation in multiple programming languages. Here are examples:

## JavaScript
```javascript
function reverse(str) {
    if (str === "") return "";
    return reverse(str.substr(1)) + str.charAt(0);
}
```

## Python
```python
def reverse(s):
    if len(s) == 0:
        return s
    return reverse(s[1:]) + s[0]
```

## Java
```java
public class Solution {
    public static String reverse(String str) {
        if (str.length() == 0) return str;
        return reverse(str.substring(1)) + str.charAt(0);
    }
}
```

## C++
```cpp
#include <iostream>
#include <string>
using namespace std;

string reverse(string str) {
    if (str.length() == 0) return str;
    return reverse(str.substr(1)) + str[0];
}
```

## C
```c
#include <stdio.h>
#include <string.h>

void reverse(char* str, char* result, int index) {
    if (str[index] == '\0') {
        result[index] = '\0';
        return;
    }
    reverse(str, result, index + 1);
    result[strlen(str) - 1 - index] = str[index];
}
```

## C#
```csharp
using System;

public class Solution {
    public static string Reverse(string str) {
        if (str.Length == 0) return str;
        return Reverse(str.Substring(1)) + str[0];
    }
}
```

## Go
```go
package main

import "fmt"

func reverse(s string) string {
    if len(s) == 0 {
        return s
    }
    return reverse(s[1:]) + string(s[0])
}
```

## Rust
```rust
fn reverse(s: &str) -> String {
    if s.is_empty() {
        return String::new();
    }
    let chars: Vec<char> = s.chars().collect();
    reverse(&s[1..]) + &chars[0].to_string()
}
```

## PHP
```php
<?php
function reverse($str) {
    if (strlen($str) == 0) return $str;
    return reverse(substr($str, 1)) . $str[0];
}
?>
```

## Ruby
```ruby
def reverse(str)
    return str if str.length == 0
    reverse(str[1..-1]) + str[0]
end
```

## Language Detection Features

The system automatically detects the programming language based on:

- **Keywords**: `def`, `function`, `public class`, `#include`, etc.
- **Syntax patterns**: Function declarations, imports, print statements
- **File structure**: Package declarations, using statements, etc.

## Supported Features

✅ **JavaScript**: Full execution with test cases
✅ **Python**: Language detection and basic validation
✅ **Java**: Class structure recognition
✅ **C++**: Include statements and namespace detection
✅ **C**: Header files and function patterns
✅ **C#**: Using statements and class structure
✅ **Go**: Package and function detection
✅ **Rust**: Function syntax and macro detection
✅ **PHP**: PHP tags and variable syntax
✅ **Ruby**: Method definitions and syntax

## How It Works

1. **Language Detection**: Analyzes code patterns to identify language
2. **Syntax Validation**: Checks for proper function structure
3. **Test Execution**: Runs code against test cases (JavaScript fully supported)
4. **Simulation**: Other languages use intelligent simulation for now
5. **Scoring**: Awards points based on correctness and test results

The system is designed to be fair across all languages and encourages participants to use their preferred programming language!