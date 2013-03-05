#!/bin/bash

# Calculate the directory of the current script
SCRIPT_DIR=$(cd "$(dirname "$0")"; pwd)
# Determine the name of the AppDev directory (could conceiveably be something other than AppDev, like AppDev2, AppDevOld, AppDevBase, etc.)
APPDEV_DIR_NAME=`basename "$SCRIPT_DIR"`
# Go out of the AppDev directory, into to the workspace directory
cd "$SCRIPT_DIR/.."
echo "$SCRIPT_DIR"

# Get the name of the operation ("create" or "update")
if [ -z "$1" ]; then
	echo "No operation specified"
	exit 1
fi
OPERATION="$1"

# Get the name of the new project
if [ -z "$2" ]; then
	echo "No project specified"
	exit 1
fi
PROJECT_NAME="$2"

# Setup
echo "Creating project $PROJECT_NAME..."
case "$OPERATION" in
	( "create" )
		echo "Creating directories..."
		mkdir "$PROJECT_NAME"
		echo "Copying templates..."
		cp -R "$APPDEV_DIR_NAME/templates/" "$PROJECT_NAME";;
	( "update")
		;;
	( "clean" )
		;;
	( * )
		echo "Invalid operation: \"$OPERATION\""
		exit 1
esac

# Create/update/remove a symbolic link to allow the project to reference AppDev framework files
updatelink()
{
	dest=`pwd`"/$1"
	src=`echo $1 | sed "s/^$APPDEV_DIR_NAME\/\(\w*\)/$PROJECT_NAME\/Resources\/\1/"`
	case "$OPERATION" in
		( "create" | "update" )
			echo "$src -> $dest"
			echo "ln -sh \"$dest\" \"$src\""
			ln -sh "$dest" "$src";;
		( "clean" )
			echo "Deleting $src"
			rm "$src";;
	esac
}
# Create/update/remove symbolic links for all files referenced by the first argument
updatelinks() {
	for i in `ls $1`; do
		updatelink $i
	done
}

# Link the db, comm, and jquery directories and all
# scripts inside the AppDev directory and the UI directory
echo "Creating links..."
updatelink "$APPDEV_DIR_NAME/db"
updatelink "$APPDEV_DIR_NAME/comm"
updatelink "$APPDEV_DIR_NAME/jquery"
updatelinks "$APPDEV_DIR_NAME/*.js"
updatelinks "$APPDEV_DIR_NAME/models/*.js"
updatelinks "$APPDEV_DIR_NAME/ui/*.js"